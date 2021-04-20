import { loadFiles } from './file-loader';
import { parseFiles } from './file-parser';
import { scanFiles } from './file-scanner';
import { formatScanResults } from './results-formatter';
import { isLocalFolder } from '../../../../lib/detect';
import {
  IaCTestFlags,
  IacFileParsed,
  IacFileParseFailure,
  SafeAnalyticsOutput,
} from './types';
import { cleanLocalCache, initLocalCache } from './local-cache';
import { addIacAnalytics } from './analytics';
import { TestResult } from '../../../../lib/snyk-test/legacy';
import { IacFileInDirectory } from '../../../../lib/types';
import { applyCustomSeverities } from './org-settings/apply-custom-severities';
import { getIacOrgSettings } from './org-settings/get-iac-org-settings';

// this method executes the local processing engine and then formats the results to adapt with the CLI output.
// the current version is dependent on files to be present locally which are not part of the source code.
// without these files this method would fail.
// if you're interested in trying out the experimental local execution model for IaC scanning, please reach-out.
export async function test(
  pathToScan: string,
  options: IaCTestFlags,
): Promise<{
  results: TestResult | TestResult[];
  /** All files scanned by IaC with parse errors */
  failures?: IacFileInDirectory[];
}> {
  await initLocalCache();
  const filesToParse = await loadFiles(pathToScan, options);
  const { parsedFiles, failedFiles } = await parseFiles(filesToParse);
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
