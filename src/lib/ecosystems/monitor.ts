import { InspectResult } from '@snyk/cli-interface/legacy/plugin';
import chalk from 'chalk';
import config from '../config';
import { isCI } from '../is-ci';
import { makeRequest } from '../request/promise';
import { Contributor, MonitorResult, Options, PolicyOptions } from '../types';
import { spinner } from '../../lib/spinner';
import { getPlugin } from './plugins';
import { BadResult, GoodResult } from '../../cli/commands/monitor/types';
import { processJsonMonitorResponse } from '../../cli/commands/monitor/process-json-monitor';
import { formatErrorMonitorOutput, formatMonitorOutput } from '../formatters';
import { getExtraProjectCount } from '../plugins/get-extra-project-count';
import {
  AuthFailedError,
  DockerImageNotFoundError,
  MonitorError,
} from '../errors';
import {
  Ecosystem,
  ScanResult,
  EcosystemMonitorResult,
  EcosystemMonitorError,
  MonitorDependenciesRequest,
  MonitorDependenciesResponse,
} from './types';
import { findAndLoadPolicyForScanResult } from './policy';
import { getAuthHeader } from '../api-token';
import { resolveAndMonitorFacts } from './resolve-monitor-facts';
import {
  generateProjectAttributes,
  generateTags,
  validateProjectAttributes,
  validateTags,
} from '../../cli/commands/monitor';
import { isUnmanagedEcosystem } from './common';
import { findAndLoadPolicy } from '../policy';

const SEPARATOR = '\n-------------------------------------------------------\n';

export async function monitorEcosystem(
  ecosystem: Ecosystem,
  paths: string[],
  options: Options & PolicyOptions,
  contributors?: Contributor[],
): Promise<[EcosystemMonitorResult[], EcosystemMonitorError[]]> {
  const plugin = getPlugin(ecosystem);

  validateTags(options);
  validateProjectAttributes(options);

  const scanResultsByPath: { [dir: string]: ScanResult[] } = {};
  for (const path of paths) {
    try {
      await spinner(`Analyzing dependencies in ${path}`);
      options.path = path;
      const pluginResponse = await plugin.scan(options);
      scanResultsByPath[path] = pluginResponse.scanResults;

      const policy = await findAndLoadPolicy(path, 'cpp', options);
      if (policy) {
        scanResultsByPath[path].forEach(
          (scanResult) => (scanResult.policy = policy.toString()),
        );
      }
    } catch (error) {
      if (
        ecosystem === 'docker' &&
        error.statusCode === 401 &&
        error.message === 'authentication required'
      ) {
        throw new DockerImageNotFoundError(path);
      }
      if (ecosystem === 'docker' && error.message === 'invalid image format') {
        throw new DockerImageNotFoundError(path);
      }

      throw error;
    } finally {
      spinner.clearAll();
    }
  }
  const [monitorResults, errors] = await selectAndExecuteMonitorStrategy(
    ecosystem,
    scanResultsByPath,
    options,
    contributors,
  );
  return [monitorResults, errors];
}

async function selectAndExecuteMonitorStrategy(
  ecosystem: Ecosystem,
  scanResultsByPath: { [dir: string]: ScanResult[] },
  options: Options,
  contributors?: Contributor[],
): Promise<[EcosystemMonitorResult[], EcosystemMonitorError[]]> {
  return isUnmanagedEcosystem(ecosystem)
    ? await resolveAndMonitorFacts(scanResultsByPath, options, contributors)
    : await monitorDependencies(scanResultsByPath, options);
}

export async function generateMonitorDependenciesRequest(
  scanResult: ScanResult,
  options: Options,
): Promise<MonitorDependenciesRequest> {
  // WARNING! This mutates the payload. The project name logic should be handled in the plugin.
  scanResult.name =
    options['project-name'] || config.PROJECT_NAME || scanResult.name;
  scanResult.targetReference = options['target-reference'];
  // WARNING! This mutates the payload. Policy logic should be in the plugin.
  const policy = await findAndLoadPolicyForScanResult(scanResult, options);
  if (policy !== undefined) {
    scanResult.policy = policy.toString();
  }

  return {
    scanResult,
    method: 'cli',
    projectName: options['project-name'] || config.PROJECT_NAME || undefined,
    tags: generateTags(options),
    attributes: generateProjectAttributes(options),
  };
}

async function monitorDependencies(
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
      const monitorDependenciesRequest =
        await generateMonitorDependenciesRequest(scanResult, options);

      const configOrg = config.org ? decodeURIComponent(config.org) : undefined;

      const payload = {
        method: 'PUT',
        url: `${config.API}/monitor-dependencies`,
        json: true,
        headers: {
          'x-is-ci': isCI(),
          authorization: getAuthHeader(),
        },
        body: monitorDependenciesRequest,
        qs: {
          org: options.org || configOrg,
        },
      };
      try {
        const response =
          await makeRequest<MonitorDependenciesResponse>(payload);
        results.push({
          ...response,
          path,
          scanResult,
        });
      } catch (error) {
        if (error.code === 401) {
          throw AuthFailedError();
        }
        if (error.code >= 400 && error.code < 500) {
          throw new MonitorError(error.code, error.message);
        }
        errors.push({
          error: 'Could not monitor dependencies in ' + path,
          path,
          scanResult,
        });
      }
    }
    spinner.clearAll();
  }
  return [results, errors];
}

export async function getFormattedMonitorOutput(
  results: Array<GoodResult | BadResult>,
  monitorResults: EcosystemMonitorResult[],
  errors: EcosystemMonitorError[],
  options: Options,
): Promise<string> {
  for (const monitorResult of monitorResults) {
    let monOutput = '';
    if (monitorResult.ok) {
      monOutput = formatMonitorOutput(
        monitorResult.scanResult.identity.type,
        monitorResult as MonitorResult,
        options,
        monitorResult.projectName,
        await getExtraProjectCount(
          monitorResult.path,
          options,
          // TODO: Fix to pass the old "inspectResult.plugin.meta.allSubProjectNames", which ecosystem uses this?
          // "allSubProjectNames" can become a Fact returned by a plugin.
          {} as InspectResult,
        ),
      );
    } else {
      monOutput = formatErrorMonitorOutput(
        monitorResult.scanResult.identity.type,
        monitorResult as MonitorResult,
        options,
      );
    }
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
      data: new MonitorError(500, monitorError.error),
      path: monitorError.path,
    });
  }

  if (options.json) {
    return processJsonMonitorResponse(results);
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
