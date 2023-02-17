import config from '../config';
import { isCI } from '../is-ci';
import { makeRequest } from '../request/promise';
import { Options, PolicyOptions } from '../types';
import { TestCommandResult } from '../../cli/commands/types';
import { spinner } from '../../lib/spinner';
import { Ecosystem, ScanResult, TestResult } from './types';
import { getPlugin } from './plugins';
import { TestDependenciesResponse } from '../snyk-test/legacy';
import { assembleQueryString } from '../snyk-test/common';
import { getAuthHeader } from '../api-token';
import { resolveAndTestFacts } from './resolve-test-facts';
import { isUnmanagedEcosystem } from './common';
import { convertDepGraph, getUnmanagedDepGraph } from './unmanaged/utils';
import { jsonStringifyLargeObject } from '../json';

type ScanResultsByPath = { [dir: string]: ScanResult[] };

export async function testEcosystem(
  ecosystem: Ecosystem,
  paths: string[],
  options: Options & PolicyOptions,
): Promise<TestCommandResult> {
  const plugin = getPlugin(ecosystem);
  // TODO: this is an intermediate step before consolidating ecosystem plugins
  // to accept flows that act differently in the testDependencies step
  if (plugin.test) {
    const { readableResult: res, sarifResult: sarifRes } = await plugin.test(
      paths,
      options,
    );
    return TestCommandResult.createHumanReadableTestCommandResult(
      res,
      '',
      sarifRes,
    );
  }
  const results: ScanResultsByPath = {};
  for (const path of paths) {
    await spinner(`Scanning dependencies in ${path}`);
    options.path = path;
    const pluginResponse = await plugin.scan(options);
    results[path] = pluginResponse.scanResults;
  }
  spinner.clearAll();

  if (isUnmanagedEcosystem(ecosystem) && options['print-graph']) {
    const [target] = paths;
    return formatUnmanagedResults(results, target);
  }

  const [testResults, errors] = await selectAndExecuteTestStrategy(
    ecosystem,
    results,
    options,
  );

  const stringifiedData = JSON.stringify(testResults, null, 2);
  if (options.json) {
    return TestCommandResult.createJsonTestCommandResult(stringifiedData);
  }
  const emptyResults: ScanResult[] = [];
  const scanResults = emptyResults.concat(...Object.values(results));

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

export async function selectAndExecuteTestStrategy(
  ecosystem: Ecosystem,
  scanResultsByPath: { [dir: string]: ScanResult[] },
  options: Options & PolicyOptions,
): Promise<[TestResult[], string[]]> {
  return isUnmanagedEcosystem(ecosystem)
    ? await resolveAndTestFacts(ecosystem, scanResultsByPath, options)
    : await testDependencies(scanResultsByPath, options);
}

export async function formatUnmanagedResults(
  results: ScanResultsByPath,
  target: string,
): Promise<TestCommandResult> {
  const [result] = await getUnmanagedDepGraph(results);
  const depGraph = convertDepGraph(result);

  const template = `DepGraph data:
${jsonStringifyLargeObject(depGraph)}
DepGraph target:
${target}
DepGraph end`;

  return TestCommandResult.createJsonTestCommandResult(template);
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
