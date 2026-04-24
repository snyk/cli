import { Writable } from 'stream';

import config from '../config';
import { isCI } from '../is-ci';
import { makeRequest } from '../request/promise';
import { Options, PolicyOptions } from '../types';
import { TestCommandResult } from '../../cli/commands/types';
import { spinner } from '../../lib/spinner';
import { Ecosystem, ScanResult, TestResult } from './types';
import { getPlugin } from './plugins';
import { TestDependenciesResponse } from '../snyk-test/legacy';
import {
  assembleQueryString,
  printDepGraph,
  shouldPrintDepGraph,
} from '../snyk-test/common';
import { getAuthHeader } from '../api-token';
import { resolveAndTestFacts } from './resolve-test-facts';
import { isUnmanagedEcosystem, filterDockerFacts } from './common';
import { convertDepGraph, getUnmanagedDepGraph } from './unmanaged/utils';

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
    const filteredResponse = await filterDockerFacts(
      pluginResponse,
      ecosystem,
      options,
    );
    results[path] = filteredResponse.scanResults;
  }
  spinner.clearAll();

  if (isUnmanagedEcosystem(ecosystem) && shouldPrintDepGraph(options)) {
    const [target] = paths;
    return printUnmanagedDepGraph(results, target, process.stdout);
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

export async function printUnmanagedDepGraph(
  results: ScanResultsByPath,
  target: string,
  destination: Writable,
): Promise<TestCommandResult> {
  const [result] = await getUnmanagedDepGraph(results);
  const depGraph = convertDepGraph(result);

  await printDepGraph(depGraph, target, destination);

  return TestCommandResult.createJsonTestCommandResult('');
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
    const [firstScanResult, ...remainingScanResults] = scanResults;
    if (!firstScanResult) {
      continue;
    }

    const firstResult = await testDependenciesForScanResult(
      firstScanResult,
      options,
      path,
    );
    if (firstResult.testResult) {
      results.push(firstResult.testResult);
    }
    if (firstResult.error) {
      errors.push(firstResult.error);
    }

    const remainingResults = await Promise.all(
      remainingScanResults.map((scanResult) =>
        testDependenciesForScanResult(scanResult, options, path),
      ),
    );

    for (const remainingResult of remainingResults) {
      if (remainingResult.testResult) {
        results.push(remainingResult.testResult);
      }
      if (remainingResult.error) {
        errors.push(remainingResult.error);
      }
    }
  }
  spinner.clearAll();
  return [results, errors];
}

async function testDependenciesForScanResult(
  scanResult: ScanResult,
  options: Options,
  path: string,
): Promise<{ testResult?: TestResult; error?: string }> {
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
    return {
      testResult: {
        issues: response.result.issues,
        issuesData: response.result.issuesData,
        depGraphData: response.result.depGraphData,
      },
    };
  } catch (error) {
    if (error.code >= 400 && error.code < 500) {
      throw new Error(error.message);
    }

    return {
      error: 'Could not test dependencies in ' + path,
    };
  }
}
