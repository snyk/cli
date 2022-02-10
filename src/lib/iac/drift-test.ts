import * as debugLib from 'debug';
import { EOL } from 'os';
import chalk from 'chalk';
import { IacFileInDirectory, Options } from '../../lib/types';
import { LegacyVulnApiResult, TestResult } from '../../lib/snyk-test/legacy';
import { mapIacTestResult } from '../../lib/snyk-test/iac-test-result';
import { getIacDisplayErrorFileOutput } from '../../lib/formatters/iac-output';
import { extractDataToSendFromResults } from '../../lib/formatters/test/format-test-results';
import { displayResult } from '../../lib/formatters/test/display-result';
import {
  cleanLocalCache,
  formatScanResults,
  initLocalCache,
  scanFiles,
} from '../../cli/commands/test/iac-local-execution/measurable-methods';
import { IacOrgSettings } from '../../cli/commands/test/iac-local-execution/types';
import { findAndLoadPolicy } from '../policy';
import { filterIgnoredIssues } from '../../cli/commands/test/iac-local-execution/policy';
import { formatTestError } from '../../cli/commands/test/format-test-error';
import { TestCommandResult } from '../../cli/commands/types';
import { tryParsingTerraformPlan } from '../../cli/commands/test/iac-local-execution/parsers/terraform-plan-parser';
import { DriftCTLOptions } from './drift';

const debug = debugLib('drift-test');
const SEPARATOR = '\n-------------------------------------------------------\n';

export async function testDrifts(
  content: string,
  options: Options & DriftCTLOptions,
  iacOrgSettings: IacOrgSettings,
): Promise<TestCommandResult> {
  let results = [] as any[];

  let iacScanFailures: IacFileInDirectory[] | undefined;

  let res: TestResult[] | Error;
  try {
    await initLocalCache();

    const parsedPlan = tryParsingTerraformPlan(
      {
        filePath: '',
        fileType: 'json',
        fileContent: content,
      },
      JSON.parse(content),
    );

    const policy = await findAndLoadPolicy('', 'iac', options as any);

    const scannedFiles = await scanFiles(parsedPlan);

    const formattedResults = formatScanResults(
      scannedFiles,
      options,
      iacOrgSettings.meta,
    );

    const { filteredIssues } = filterIgnoredIssues(policy, formattedResults);

    res = (filteredIssues as unknown) as TestResult[];
  } catch (error) {
    res = formatTestError(error);
  } finally {
    cleanLocalCache();
  }

  results = Array.isArray(res) ? res : [res];

  const vulnerableResults = results.filter(
    (res) =>
      (res.vulnerabilities && res.vulnerabilities.length) ||
      (res.result &&
        res.result.cloudConfigResults &&
        res.result.cloudConfigResults.length),
  );
  const errorResults = results.filter((res) => res instanceof Error);
  const notSuccess = errorResults.length > 0;
  const foundVulnerabilities = vulnerableResults.length > 0;

  const mappedResults = results.map(mapIacTestResult);

  const {
    stringifiedJsonData,
    stringifiedSarifData,
  } = extractDataToSendFromResults(results, mappedResults, options);

  let response = results
    .map((result, i) =>
      displayResult(
        results[i] as LegacyVulnApiResult,
        options as any,
        result.foundProjectCount,
      ),
    )
    .join(`\n${SEPARATOR}`);

  if (notSuccess) {
    debug(`Failed to test ${errorResults.length} projects, errors:`);
    errorResults.forEach((err) => {
      const errString = err.stack ? err.stack.toString() : err.toString();
      debug('error: %s', errString);
    });
  }

  const summaryMessage = '';

  if (iacScanFailures) {
    for (const reason of iacScanFailures) {
      response += chalk.bold.red(getIacDisplayErrorFileOutput(reason));
    }
  }

  if (notSuccess) {
    response += chalk.bold.red(summaryMessage);

    const error = new Error(response) as any;
    error.code = errorResults[0].code;
    error.userMessage = errorResults[0].userMessage;
    error.strCode = errorResults[0].strCode;
    throw error;
  }

  if (foundVulnerabilities) {
    response += chalk.bold.red(summaryMessage);

    const error = new Error(response) as any;
    error.code = vulnerableResults[0].code || 'VULNS';
    error.userMessage = vulnerableResults[0].userMessage;
    error.jsonStringifiedResults = stringifiedJsonData;
    error.sarifStringifiedResults = stringifiedSarifData;
    throw error;
  }

  response += chalk.bold.green(summaryMessage);
  response += EOL + EOL;

  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    stringifiedJsonData,
    stringifiedSarifData,
  );
}
