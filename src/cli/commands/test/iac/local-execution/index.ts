import { existsSync } from 'fs';
import { isLocalFolder } from '../../../../../lib/detect';
import {
  EngineType,
  IaCErrorCodes,
  IacFileParsed,
  IacFileParseFailure,
  IacOrgSettings,
  IaCTestFlags,
  RulesOrigin,
  SafeAnalyticsOutput,
  TestReturnValue,
} from './types';
import { addIacAnalytics } from './analytics';
import { TestLimitReachedError } from './usage-tracking';
import { TestResult } from '../../../../../lib/snyk-test/legacy';
import {
  applyCustomSeverities,
  loadContentForFiles,
  parseFiles,
  scanFiles,
  trackUsage,
} from './measurable-methods';
import { findAndLoadPolicy } from '../../../../../lib/policy';
import { ResultsProcessor } from './process-results';
import { generateProjectAttributes, generateTags } from '../../../monitor';
import {
  getAllDirectoriesForPath,
  getFilesForDirectory,
} from './directory-loader';
import { CustomError } from '../../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import { NoFilesToScanError } from './file-loader';
import { Tag } from '../../../../../lib/types';

// this method executes the local processing engine and then formats the results to adapt with the CLI output.
// this flow is the default GA flow for IAC scanning.
export async function test(
  resultsProcessor: ResultsProcessor,
  pathToScan: string,
  options: IaCTestFlags,
  iacOrgSettings: IacOrgSettings,
  rulesOrigin: RulesOrigin,
): Promise<TestReturnValue> {
  // Parse tags and attributes right now, so we can exit early if the user
  // provided invalid values.
  const tags = parseTags(options);
  const attributes = parseAttributes(options);

  const policy = await findAndLoadPolicy(pathToScan, 'iac', options);

  let allParsedFiles: IacFileParsed[] = [],
    allFailedFiles: IacFileParseFailure[] = [];
  const allDirectories = getAllDirectoriesForPath(
    pathToScan,
    options.detectionDepth,
  );

  // we load and parse files directory by directory
  // because we need all files in the same directory to share the same variable context for Terraform
  for (const currentDirectory of allDirectories) {
    const filePathsInDirectory = getFilesForDirectory(
      pathToScan,
      currentDirectory,
    );
    if (
      currentDirectory === pathToScan &&
      shouldLoadVarDefinitionsFile(options)
    ) {
      const varDefinitionsFilePath = options['var-file'];
      filePathsInDirectory.push(varDefinitionsFilePath);
    }
    const filesToParse = await loadContentForFiles(filePathsInDirectory);
    const { parsedFiles, failedFiles } = await parseFiles(
      filesToParse,
      options,
    );
    allParsedFiles = allParsedFiles.concat(parsedFiles);
    allFailedFiles = allFailedFiles.concat(failedFiles);
  }

  if (allParsedFiles.length === 0) {
    if (allFailedFiles.length === 0) {
      throw new NoFilesToScanError();
    } else {
      // we throw an array of errors in order to get the path of the files which generated an error
      throw allFailedFiles.map((f) => f.err);
    }
  }

  // Duplicate all the files and run them through the custom engine.
  if (rulesOrigin !== RulesOrigin.Internal) {
    allParsedFiles.push(
      ...allParsedFiles.map((file) => ({
        ...file,
        engineType: EngineType.Custom,
      })),
    );
  }
  // NOTE: No file or parsed file data should leave this function.
  let failures = isLocalFolder(pathToScan)
    ? allFailedFiles.map(removeFileContent)
    : [];

  const { scannedFiles, failedScans } = await scanFiles(allParsedFiles);
  failures = [...failures, ...failedScans];

  const resultsWithCustomSeverities = await applyCustomSeverities(
    scannedFiles,
    iacOrgSettings.customPolicies,
  );

  const { filteredIssues, ignoreCount } = await resultsProcessor.processResults(
    resultsWithCustomSeverities,
    policy,
    tags,
    attributes,
  );

  try {
    await trackUsage(filteredIssues);
  } catch (e) {
    if (e instanceof TestLimitReachedError) {
      throw e;
    }
    // If something has gone wrong, err on the side of allowing the user to
    // run their tests by squashing the error.
  }

  addIacAnalytics(filteredIssues, {
    ignoredIssuesCount: ignoreCount,
    rulesOrigin,
  });

  // TODO: add support for proper typing of old TestResult interface.
  return {
    results: (filteredIssues as unknown) as TestResult[],
    failures,
    ignoreCount,
  };
}

export function removeFileContent({
  filePath,
  fileType,
  failureReason,
  projectType,
}: IacFileParsed | IacFileParseFailure): SafeAnalyticsOutput {
  return {
    filePath,
    fileType,
    failureReason,
    projectType,
  };
}

export function parseTags(options: IaCTestFlags): Tag[] | undefined {
  if (options.report) {
    return generateTags(options);
  }
}

function parseAttributes(options: IaCTestFlags) {
  if (options.report) {
    return generateProjectAttributes(options);
  }
}

function shouldLoadVarDefinitionsFile(
  options: IaCTestFlags,
): options is IaCTestFlags & { 'var-file': string } {
  if (options['var-file']) {
    if (!existsSync(options['var-file'])) {
      throw new InvalidVarFilePath(options['var-file']);
    }
    return true;
  }
  return false;
}

export class InvalidVarFilePath extends CustomError {
  constructor(path: string, message?: string) {
    super(message || 'Invalid path to variable definitions file');
    this.code = IaCErrorCodes.InvalidVarFilePath;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to locate a variable definitions file at: "${path}". The file at the provided path does not exist`;
  }
}
