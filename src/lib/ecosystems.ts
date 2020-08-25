import * as cppPlugin from 'snyk-cpp-plugin';
import { Options } from './types';
import { TestCommandResult } from '../cli/commands/types';
import * as config from './config';
import { isCI } from './is-ci';
import * as snyk from './';
import request = require('./request');
import { DepGraphData } from '@snyk/dep-graph';

interface Artifact {
  type: string;
  data: any;
  meta: { [key: string]: any };
}

interface ScanResult {
  type: string;
  artifacts: Artifact[];
  meta: {
    [key: string]: any;
  };
}

interface TestResults {
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
    testResults: TestResults[],
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
  let scanResults: ScanResult[] = [];
  for (const path of paths) {
    options.path = path;
    const results = await plugin.scan(options);
    scanResultsByPath[path] = results;
    scanResults = scanResults.concat(results);
  }

  const [testResults, errors] = await testDependencies(scanResultsByPath);
  const stringifiedData = JSON.stringify(testResults, null, 2);
  if (options.json) {
    return TestCommandResult.createJsonTestCommandResult(stringifiedData);
  }
  const readableResult = await plugin.display(scanResults, testResults, errors);

  return TestCommandResult.createHumanReadableTestCommandResult(
    readableResult,
    stringifiedData,
  );
}

export async function testDependencies(scans: {
  [dir: string]: ScanResult[];
}): Promise<[TestResults[], string[]]> {
  const results: TestResults[] = [];
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
          type: 'cpp',
          artifacts: scanResult.artifacts,
          meta: {},
        },
      };
      try {
        const response = await makeRequest(payload);
        results.push(response);
      } catch (error) {
        if (error.code !== 200) {
          throw new Error(error.message);
        }
        errors.push('Could not test dependencies in ' + path);
      }
    }
  }
  return [results, errors];
}

export async function makeRequest(payload: any): Promise<TestResults> {
  return new Promise((resolve, reject) => {
    request(payload, (error, res, body) => {
      if (error) {
        return reject(error);
      }
      if (res.statusCode !== 200) {
        return reject({
          code: res.statusCode,
          message: res?.body?.message || 'Error testing dependencies',
        });
      }
      resolve(body);
    });
  });
}
