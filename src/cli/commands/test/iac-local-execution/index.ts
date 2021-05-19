import { isLocalFolder } from '../../../../lib/detect';
import {
  IaCTestFlags,
  IacFileParsed,
  IacFileParseFailure,
  SafeAnalyticsOutput,
  TestReturnValue,
  EngineType,
} from './types';
import { addIacAnalytics } from './analytics';
import { TestResult } from '../../../../lib/snyk-test/legacy';
import {
  initLocalCache,
  loadFiles,
  parseFiles,
  scanFiles,
  getIacOrgSettings,
  applyCustomSeverities,
  formatScanResults,
  cleanLocalCache,
} from './measurable-methods';
import { isFeatureFlagSupportedForOrg } from '../../../../lib/feature-flags';
import { FlagError } from './assert-iac-options-flag';
import config = require('../../../../lib/config');

// this method executes the local processing engine and then formats the results to adapt with the CLI output.
// this flow is the default GA flow for IAC scanning.
export async function test(
  pathToScan: string,
  options: IaCTestFlags,
): Promise<TestReturnValue> {
  try {
    const org = options.org ?? config.org;
    const iacOrgSettings = await getIacOrgSettings(org);
    const customRulesPath = await customRulesPathForOrg(options.rules, org);

    await initLocalCache({ customRulesPath });

    const filesToParse = await loadFiles(pathToScan, options);
    const { parsedFiles, failedFiles } = await parseFiles(
      filesToParse,
      options,
    );

    // Duplicate all the files and run them through the custom engine.
    if (customRulesPath) {
      parsedFiles.push(
        ...parsedFiles.map((file) => ({
          ...file,
          engineType: EngineType.Custom,
        })),
      );
    }

    const scannedFiles = await scanFiles(parsedFiles);
    const resultsWithCustomSeverities = await applyCustomSeverities(
      scannedFiles,
      iacOrgSettings.customPolicies,
    );
    const formattedResults = formatScanResults(
      resultsWithCustomSeverities,
      options,
      iacOrgSettings.meta,
    );
    addIacAnalytics(formattedResults);

    // TODO: add support for proper typing of old TestResult interface.
    return {
      results: (formattedResults as unknown) as TestResult[],
      // NOTE: No file or parsed file data should leave this function.
      failures: isLocalFolder(pathToScan)
        ? failedFiles.map(removeFileContent)
        : undefined,
    };
  } finally {
    cleanLocalCache();
  }
}

async function customRulesPathForOrg(
  customRulesPath: string | undefined,
  publicOrgId: string,
): Promise<string | undefined> {
  if (!customRulesPath) return;

  const isCustomRulesSupported =
    (await isFeatureFlagSupportedForOrg('iacCustomRules', publicOrgId)).ok ===
    true;
  if (isCustomRulesSupported) {
    return customRulesPath;
  }

  throw new FlagError('rules');
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
