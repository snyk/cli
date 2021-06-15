import * as config from '../config';
import { isCI } from '../is-ci';
import { makeRequest } from '../request/promise';
import { Options } from '../types';
import { TestCommandResult } from '../../cli/commands/types';
import * as spinner from '../../lib/spinner';
import { Ecosystem, EcosystemPlugin, ScanResult, TestResult } from './types';
import { getPlugin } from './plugins';
import { TestDependenciesResponse } from '../snyk-test/legacy';
import { assembleQueryString } from '../snyk-test/common';
import { getAuthHeader } from '../api-token';
import { requestPollingToken, pollingWithTokenUntilDone } from './polling';

export async function testEcosystem(
  ecosystem: Ecosystem,
  paths: string[],
  options: Options,
): Promise<TestCommandResult> {
  const plugin = getPlugin(ecosystem);
  // TODO: this is an intermediate step before consolidating ecosystem plugins
  // to accept flows that act differently in the testDependencies step
  if (plugin.test) {
    const { readableResult: res } = await plugin.test(paths, options);
    return TestCommandResult.createHumanReadableTestCommandResult(res, '');
  }
  const scanResultsByPath: { [dir: string]: ScanResult[] } = {};
  for (const path of paths) {
    await spinner(`Scanning dependencies in ${path}`);
    options.path = path;
    const pluginResponse = await plugin.scan(options);
    scanResultsByPath[path] = pluginResponse.scanResults;
  }
  spinner.clearAll();

  if (ecosystem === 'cpp') {
    const [testResults, errors] = await resolveAndTestFacts(
      ecosystem,
      scanResultsByPath,
      options,
    );
    return await getTestResultsOutput(
      errors,
      options,
      testResults,
      plugin,
      scanResultsByPath,
    );
  }

  const [testResults, errors] = await testDependencies(
    scanResultsByPath,
    options,
  );

  return await getTestResultsOutput(
    errors,
    options,
    testResults,
    plugin,
    scanResultsByPath,
  );
}

async function getTestResultsOutput(
  errors: string[],
  options: Options,
  testResults: TestResult[],
  plugin: EcosystemPlugin,
  scanResultsByPath: { [dir: string]: ScanResult[] },
) {
  const stringifiedData = JSON.stringify(testResults, null, 2);
  if (options.json) {
    return TestCommandResult.createJsonTestCommandResult(stringifiedData);
  }
  const emptyResults: ScanResult[] = [];
  const scanResults = emptyResults.concat(...Object.values(scanResultsByPath));
  const readableResult = await plugin.display(
    scanResults,
    testResults,
    errors,
    options,
  );

  return TestCommandResult.createHumanReadableTestCommandResult(
    readableResult,
    stringifiedData,
  );
}

export async function resolveAndTestFacts(
  ecosystem: Ecosystem,
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options,
): Promise<[TestResult[], string[]]> {
  const results: any[] = [];
  const errors: string[] = [];
  for (const [path, scanResults] of Object.entries(scans)) {
    await spinner(`Resolving and Testing C/C++ fileSignatures in ${path}`);
    for (const scanResult of scanResults) {
      try {
        const res = await requestPollingToken(options, true, scanResult);
        if (!res.token && !res.status) {
          throw 'Something went wrong, token and status n/a';
        }
        //TODO (@snyk/tundra): poll interval could be based on amount of fileSignatures to be resolved?
        const pollInterval = 30000;
        const attemptsCount = 0;
        const maxAttempts = 250;

        const response = await pollingWithTokenUntilDone(
          res.token,
          ecosystem,
          options,
          pollInterval,
          attemptsCount,
          maxAttempts,
        );

        if (response.meta && response.result) {
          results.push({
            issues: response.result.issues,
            issuesData: response.result.issuesData,
            depGraphData: response.result.depGraphData,
          });
        }
      } catch (error) {
        const hasStatusCodeError = error.code >= 400 && error.code < 500;
        const pollingMaxAttemptsExceeded =
          error.message === 'Exceeded Polling maxAttempts';
        if (hasStatusCodeError || pollingMaxAttemptsExceeded) {
          throw new Error(error.message);
        }

        if (error.code >= 500) {
          const errorMsg = `Could not test dependencies in ${path} \n${error.message}`;
          errors.push(errorMsg);
          continue;
        }
        errors.push(`Could not test dependencies in ${path}`);
      }
    }
  }
  spinner.clearAll();
  return [results, errors];
}

async function testDependencies(
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options,
): Promise<[TestResult[], string[]]> {
  const results: TestResult[] = [];
  const errors: string[] = [];
  for (const [path, scanResults] of Object.entries(scans)) {
    await spinner(`Testing dependencies in ${path}`);
    for (const scanResult of scanResults) {
      const payload = {
        method: 'POST',
        url: `${config.API}/test-dependencies`,
        json: true,
        headers: {
          'x-is-ci': isCI(),
          authorization: getAuthHeader(),
        },
        body: {
          scanResult,
        },
        qs: assembleQueryString(options),
      };
      try {
        const response = await makeRequest<TestDependenciesResponse>(payload);
        results.push({
          issues: response.result.issues,
          issuesData: response.result.issuesData,
          depGraphData: response.result.depGraphData,
        });
      } catch (error) {
        if (error.code >= 400 && error.code < 500) {
          throw new Error(error.message);
        }
        errors.push('Could not test dependencies in ' + path);
      }
    }
  }
  spinner.clearAll();
  return [results, errors];
}
