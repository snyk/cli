import { InspectResult } from '@snyk/cli-interface/legacy/plugin';
import chalk from 'chalk';

import * as snyk from './index';
import * as config from './config';
import { isCI } from './is-ci';
import { makeRequest } from './request/promise';
import { MonitorResult, Options } from './types';
import { TestCommandResult } from '../cli/commands/types';
import * as spinner from '../lib/spinner';
import { formatMonitorOutput } from '../cli/commands/monitor/formatters/format-monitor-response';
import { GoodResult, BadResult } from '../cli/commands/monitor/types';
import { MonitorError } from './errors';
import { getExtraProjectCount } from './plugins/get-extra-project-count';
import {
  Ecosystem,
  getPlugin,
  ScanResult,
  TestResult,
} from './ecosystems-plugins';

const SEPARATOR = '\n-------------------------------------------------------\n';

export interface EcosystemMonitorError {
  error: string;
  path: string;
  scanResult: ScanResult;
}

export interface MonitorDependenciesResponse {
  ok: boolean;
  org: string;
  id: string;
  isMonitored: boolean;
  licensesPolicy: any;
  uri: string;
  trialStarted: boolean;
  path: string;
  projectName: string;
}

export interface EcosystemMonitorResult extends MonitorDependenciesResponse {
  scanResult: ScanResult;
}

export interface MonitorDependenciesRequest {
  scanResult: ScanResult;

  /** If provided, overrides the default project name (usually equivalent to the root package). */
  projectName?: string;
  policy?: string;
  method?: 'cli';
}

export function getEcosystem(options: Options): Ecosystem | null {
  if (options.source) {
    return 'cpp';
  }
  if (options.docker) {
    return 'docker';
  }
  return null;
}

export async function testEcosystem(
  ecosystem: Ecosystem,
  paths: string[],
  options: Options,
): Promise<TestCommandResult> {
  const plugin = getPlugin(ecosystem);
  const scanResultsByPath: { [dir: string]: ScanResult[] } = {};
  for (const path of paths) {
    options.path = path;
    const pluginResponse = await plugin.scan(options);
    scanResultsByPath[path] = pluginResponse.scanResults;
  }
  const [testResults, errors] = await testDependencies(scanResultsByPath);
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

export async function testDependencies(scans: {
  [dir: string]: ScanResult[];
}): Promise<[TestResult[], string[]]> {
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
          authorization: 'token ' + snyk.api,
        },
        body: {
          ...scanResult,
        },
      };
      try {
        const response = await makeRequest<TestResult>(payload);
        results.push(response);
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

export async function monitorEcosystem(
  ecosystem: Ecosystem,
  paths: string[],
  options: Options,
): Promise<[EcosystemMonitorResult[], EcosystemMonitorError[]]> {
  const plugin = getPlugin(ecosystem);
  const scanResultsByPath: { [dir: string]: ScanResult[] } = {};
  for (const path of paths) {
    await spinner(`Analyzing dependencies in ${path}`);
    options.path = path;
    const pluginResponse = await plugin.scan(options);
    scanResultsByPath[path] = pluginResponse.scanResults;
  }
  const [monitorResults, errors] = await monitorDependencies(
    scanResultsByPath,
    options,
  );
  return [monitorResults, errors];
}

function generateMonitorDependenciesRequest(
  scanResult: ScanResult,
  options: Options,
): MonitorDependenciesRequest {
  return {
    scanResult,
    method: 'cli',
    projectName: options['project-name'] || config.PROJECT_NAME || undefined,
  };
}

export async function monitorDependencies(
  scans: {
    [dir: string]: ScanResult[];
  },
  options: Options,
): Promise<[EcosystemMonitorResult[], EcosystemMonitorError[]]> {
  const results: EcosystemMonitorResult[] = [];
  const errors: EcosystemMonitorError[] = [];
  for (const [path, scanResults] of Object.entries(scans)) {
    await spinner(`Monitoring dependencies in ${path}`);
    for (const scanResult of scanResults) {
      const monitorDependenciesRequest = generateMonitorDependenciesRequest(
        scanResult,
        options,
      );

      monitorDependenciesRequest.scanResult.facts = monitorDependenciesRequest.scanResult.facts.filter(
        (fact) => fact.type !== 'imageOsReleasePrettyName',
      );

      const payload = {
        method: 'PUT',
        url: `${config.API}/monitor-dependencies`,
        json: true,
        headers: {
          'x-is-ci': isCI(),
          authorization: 'token ' + snyk.api,
        },
        body: monitorDependenciesRequest,
      };
      try {
        const response = await makeRequest<MonitorDependenciesResponse>(
          payload,
        );
        results.push({
          ...response,
          path,
          scanResult,
        });
      } catch (error) {
        if (error.code >= 400 && error.code < 500) {
          throw new Error(error.message);
        }
        errors.push({
          error: 'Could not monitor dependencies in ' + path,
          path,
          scanResult,
        });
      }
    }
  }
  spinner.clearAll();
  return [results, errors];
}

export async function getFormattedMonitorOutput(
  results: Array<GoodResult | BadResult>,
  monitorResults: EcosystemMonitorResult[],
  errors: EcosystemMonitorError[],
  options: Options,
): Promise<string> {
  for (const monitorResult of monitorResults) {
    const monOutput = formatMonitorOutput(
      monitorResult.scanResult.identity.type,
      monitorResult as MonitorResult,
      options,
      monitorResult.projectName,
      await getExtraProjectCount(
        monitorResult.path,
        options,
        // TODO: Fix to pass the old "inspectResult.plugin.meta.allSubProjectNames", which ecosystem uses this?
        {} as InspectResult,
      ),
    );
    results.push({
      ok: true,
      data: monOutput,
      path: monitorResult.path,
      projectName: monitorResult.id,
    });
  }
  for (const monitorError of errors) {
    results.push({
      ok: false,
      data: new MonitorError(500, monitorError),
      path: monitorError.path,
    });
  }

  const outputString = results
    .map((res) => {
      if (res.ok) {
        return res.data;
      }

      const errorMessage =
        res.data && res.data.userMessage
          ? chalk.bold.red(res.data.userMessage)
          : res.data
          ? res.data.message
          : 'Unknown error occurred.';

      return (
        chalk.bold.white('\nMonitoring ' + res.path + '...\n\n') + errorMessage
      );
    })
    .join('\n' + SEPARATOR);

  if (results.every((res) => res.ok)) {
    return outputString;
  }

  throw new Error(outputString);
}
