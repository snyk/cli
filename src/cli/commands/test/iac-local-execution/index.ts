import { isLocalFolder } from '../../../../lib/detect';
import {
  IaCTestFlags,
  IacFileParsed,
  IacFileParseFailure,
  SafeAnalyticsOutput,
  TestReturnValue,
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
// this method executes the local processing engine and then formats the results to adapt with the CLI output.
// this flow is the default GA flow for IAC scanning.
export async function test(
  pathToScan: string,
  options: IaCTestFlags,
): Promise<TestReturnValue> {
  await initLocalCache();
  const filesToParse = await loadFiles(pathToScan, options);
  const { parsedFiles, failedFiles } = await parseFiles(filesToParse, options);
  const scannedFiles = await scanFiles(parsedFiles);
  const iacOrgSettings = await getIacOrgSettings();
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
  cleanLocalCache();

  // TODO: add support for proper typing of old TestResult interface.
  return {
    results: (formattedResults as unknown) as TestResult[],
    // NOTE: No file or parsed file data should leave this function.
    failures: isLocalFolder(pathToScan)
      ? failedFiles.map(removeFileContent)
      : undefined,
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
