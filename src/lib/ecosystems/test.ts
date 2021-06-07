import * as config from '../config';
import { isCI } from '../is-ci';
import { makeRequest } from '../request/promise';
import { Options } from '../types';
import { TestCommandResult } from '../../cli/commands/types';
import * as spinner from '../../lib/spinner';
import { Ecosystem, ScanResult, TestResult } from './types';
import { getPlugin } from './plugins';
import { TestDependenciesResponse } from '../snyk-test/legacy';
import { assembleQueryString } from '../snyk-test/common';
import { getAuthHeader } from '../api-token';
import { hasToDetourToLegacyFlow } from './enhance-options';

export async function testEcosystem(
  ecosystem: Ecosystem,
  paths: string[],
  options: Options,
): Promise<TestCommandResult> {
  const plugin = getPlugin(ecosystem);

  const enhancedOptions = {
    ...options,
    detour: await hasToDetourToLegacyFlow(ecosystem, options),
  };

  // TODO: this is an intermediate step before consolidating ecosystem plugins
  // to accept flows that act differently in the testDependencies step
  if (plugin.test) {
    const { readableResult: res } = await plugin.test(paths, enhancedOptions);
    return TestCommandResult.createHumanReadableTestCommandResult(res, '');
  }

  const scanResultsByPath: { [dir: string]: ScanResult[] } = {};
  for (const path of paths) {
    await spinner(`Scanning dependencies in ${path}`);
    enhancedOptions.path = path;
    const pluginResponse = await plugin.scan(enhancedOptions);
    scanResultsByPath[path] = pluginResponse.scanResults;
  }
  spinner.clearAll();
  const [testResults, errors] = await testDependencies(
    scanResultsByPath,
    enhancedOptions,
  );
  const stringifiedData = JSON.stringify(testResults, null, 2);
  if (enhancedOptions.json) {
    return TestCommandResult.createJsonTestCommandResult(stringifiedData);
  }
  const emptyResults: ScanResult[] = [];
  const scanResults = emptyResults.concat(...Object.values(scanResultsByPath));
  const readableResult = await plugin.display(
    scanResults,
    testResults,
    errors,
    enhancedOptions,
  );

  return TestCommandResult.createHumanReadableTestCommandResult(
    readableResult,
    stringifiedData,
  );
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
