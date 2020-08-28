import * as cppPlugin from 'snyk-cpp-plugin';
import { DepGraphData } from '@snyk/dep-graph';
import * as snyk from './index';
import * as config from './config';
import { isCI } from './is-ci';
import { makeRequest } from './request/promise';
import { Options } from './types';
import { TestCommandResult } from '../cli/commands/types';
export interface Artifact {
  type: string;
  data: any;
  meta: { [key: string]: any };
}

export interface ScanResult {
  type: string;
  artifacts: Artifact[];
  meta: {
    [key: string]: any;
  };
}

export interface TestResult {
  depGraph: DepGraphData;
  affectedPkgs: {
    [pkgId: string]: {
      pkg: {
        name: string;
        version: string;
      };
      issues: {
        [issueId: string]: {
          issueId: string;
        };
      };
    };
  };
  issuesData: {
    [issueId: string]: {
      id: string;
      severity: string;
      title: string;
    };
  };
}

export interface EcosystemPlugin {
  scan: (options: Options) => Promise<ScanResult[]>;
  display: (
    scanResults: ScanResult[],
    testResults: TestResult[],
    errors: string[],
  ) => Promise<string>;
}

export type Ecosystem = 'cpp';

const EcosystemPlugins: {
  readonly [ecosystem in Ecosystem]: EcosystemPlugin;
} = {
  cpp: cppPlugin,
};

export function getPlugin(ecosystem: Ecosystem): EcosystemPlugin {
  return EcosystemPlugins[ecosystem];
}

export function getEcosystem(options: Options): Ecosystem | null {
  if (options.source) {
    return 'cpp';
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
    const results = await plugin.scan(options);
    scanResultsByPath[path] = results;
  }

  const [testResults, errors] = await testDependencies(scanResultsByPath);
  const stringifiedData = JSON.stringify(testResults, null, 2);
  if (options.json) {
    return TestCommandResult.createJsonTestCommandResult(stringifiedData);
  }
  const emptyResults: ScanResult[] = [];
  const scanResults = emptyResults.concat(...Object.values(scanResultsByPath));
  const readableResult = await plugin.display(scanResults, testResults, errors);

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
          type: scanResult.type,
          artifacts: scanResult.artifacts,
          meta: {},
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
  return [results, errors];
}
