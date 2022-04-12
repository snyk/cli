import { existsSync } from 'fs';
import { isLocalFolder } from '../../../../../lib/detect';
import {
  EngineType,
  IaCErrorCodes,
  IacFileParsed,
  IacFileParseFailure,
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
  cleanLocalCache,
  getIacOrgSettings,
  loadContentForFiles,
  parseFiles,
  scanFiles,
  trackUsage,
} from './measurable-methods';
import { UnsupportedEntitlementError } from '../../../../../lib/errors/unsupported-entitlement-error';
import config from '../../../../../lib/config';
import { findAndLoadPolicy } from '../../../../../lib/policy';
import { isFeatureFlagSupportedForOrg } from '../../../../../lib/feature-flags';
import { initRules } from './rules';
import { NoFilesToScanError } from './file-loader';
import { processResults } from './process-results';
import { generateProjectAttributes, generateTags } from '../../../monitor';
import {
  getAllDirectoriesForPath,
  getFilesForDirectory,
} from './directory-loader';
import { CustomError } from '../../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import { FeatureFlagError } from './assert-iac-options-flag';

// this method executes the local processing engine and then formats the results to adapt with the CLI output.
// this flow is the default GA flow for IAC scanning.
export async function test(
  pathToScan: string,
  options: IaCTestFlags,
): Promise<TestReturnValue> {
  try {
    const orgPublicId = options.org ?? config.org;
    const iacOrgSettings = await getIacOrgSettings(orgPublicId);

    if (!iacOrgSettings.entitlements?.infrastructureAsCode) {
      throw new UnsupportedEntitlementError('infrastructureAsCode');
    }

    // Parse tags and attributes right now, so we can exit early if the user
    // provided invalid values.
    const tags = parseTags(options);
    const attributes = parseAttributes(options);

    const rulesOrigin = await initRules(iacOrgSettings, options);

    const policy = await findAndLoadPolicy(pathToScan, 'iac', options);

    const isTFVarSupportEnabled = (
      await isFeatureFlagSupportedForOrg(
        'iacTerraformVarSupport',
        iacOrgSettings.meta.org,
      )
    ).ok;

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
        shouldLoadVarDefinitionsFile(options, isTFVarSupportEnabled)
      ) {
        const varDefinitionsFilePath = options['var-file'];
        filePathsInDirectory.push(varDefinitionsFilePath);
      }
      const filesToParse = await loadContentForFiles(filePathsInDirectory);
      const { parsedFiles, failedFiles } = await parseFiles(
        filesToParse,
        options,
        isTFVarSupportEnabled,
      );
      allParsedFiles = allParsedFiles.concat(parsedFiles);
      allFailedFiles = allFailedFiles.concat(failedFiles);
    }

    // if none of the files were parsed then either we didn't have any IaC files
    // or there was only one file passed via the CLI and it failed parsing
    if (allParsedFiles.length === 0) {
      if (allFailedFiles.length === 1) {
        throw allFailedFiles[0].err;
      } else {
        throw new NoFilesToScanError();
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

    const scannedFiles = await scanFiles(allParsedFiles);
    const resultsWithCustomSeverities = await applyCustomSeverities(
      scannedFiles,
      iacOrgSettings.customPolicies,
    );
    const { filteredIssues, ignoreCount } = await processResults(
      resultsWithCustomSeverities,
      orgPublicId,
      iacOrgSettings,
      policy,
      tags,
      attributes,
      options,
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
      // NOTE: No file or parsed file data should leave this function.
      failures: isLocalFolder(pathToScan)
        ? allFailedFiles.map(removeFileContent)
        : undefined,
      ignoreCount,
    };
  } finally {
    cleanLocalCache();
  }
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

function parseTags(options: IaCTestFlags) {
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
  isTFVarSupportEnabled = false,
): options is IaCTestFlags & { 'var-file': string } {
  if (options['var-file']) {
    if (!isTFVarSupportEnabled) {
      throw new FeatureFlagError('var-file', 'iacTerraformVarSupport');
    }
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
