import { TestConfig } from '../types';
import * as childProcess from 'child_process';
import { CustomError } from '../../../../errors';
import { IaCErrorCodes } from '../../../../../cli/commands/test/iac/local-execution/types';
import { getErrorStringCode } from '../../../../../cli/commands/test/iac/local-execution/error-utils';
import * as newDebug from 'debug';
import {
  mapSnykIacTestOutputToTestOutput,
  SnykIacTestOutput,
  TestOutput,
} from './results';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import config from '../../../../config';
import { getAuthHeader } from '../../../../api-token';
import { allowAnalytics } from '../../../../analytics';
import envPaths from 'env-paths';

const debug = newDebug('snyk-iac');

export const systemCachePath = config.CACHE_PATH ?? envPaths('snyk').cache;

export function scan(
  options: TestConfig,
  policyEnginePath: string,
  rulesBundlePath: string,
): TestOutput {
  const configPath = createConfig(options);
  try {
    return scanWithConfig(
      options,
      policyEnginePath,
      rulesBundlePath,
      configPath,
    );
  } finally {
    deleteConfig(configPath);
  }
}

function scanWithConfig(
  options: TestConfig,
  policyEnginePath: string,
  rulesBundlePath: string,
  configPath: string,
): TestOutput {
  const args = processFlags(options, rulesBundlePath, configPath);

  args.push(...options.paths);

  const process = childProcess.spawnSync(policyEnginePath, args, {
    encoding: 'utf-8',
    stdio: 'pipe',
    maxBuffer: 1024 * 1024 * 10, // The default value is 1024 * 1024, if we see in the future that multiplying it by 10 is not enough we can increase it further.
  });

  debug('policy engine standard error:\n%s', '\n' + process.stderr);

  if (process.status && process.status !== 0) {
    throw new ScanError(`invalid exit status: ${process.status}`);
  }

  if (process.error) {
    throw new ScanError(`spawning process: ${process.error}`);
  }

  let snykIacTestOutput: SnykIacTestOutput;

  try {
    snykIacTestOutput = JSON.parse(process.stdout);
  } catch (e) {
    throw new ScanError(`invalid output encoding: ${e}`);
  }

  return mapSnykIacTestOutputToTestOutput(snykIacTestOutput);
}

function processFlags(
  options: TestConfig,
  rulesBundlePath: string,
  configPath: string,
) {
  const flags = [
    '-cache-dir',
    systemCachePath,
    '-bundle',
    rulesBundlePath,
    '-config',
    configPath,
  ];

  if (options.severityThreshold) {
    flags.push('-severity-threshold', options.severityThreshold);
  }

  if (options.attributes?.criticality) {
    flags.push(
      '-project-business-criticality',
      options.attributes.criticality.join(','),
    );
  }

  if (options.attributes?.environment) {
    flags.push(
      '-project-environment',
      options.attributes.environment.join(','),
    );
  }

  if (options.attributes?.lifecycle) {
    flags.push('-project-lifecycle', options.attributes.lifecycle.join(','));
  }

  if (options.projectTags) {
    const stringifiedTags = options.projectTags
      .map((tag) => {
        return `${tag.key}=${tag.value}`;
      })
      .join(',');
    flags.push('-project-tags', stringifiedTags);
  }

  if (options.report) {
    flags.push('-report');
  }

  if (options.targetReference) {
    flags.push('-target-reference', options.targetReference);
  }

  if (options.targetName) {
    flags.push('-target-name', options.targetName);
  }

  if (options.scan) {
    flags.push('-scan', options.scan);
  }

  if (options.remoteRepoUrl) {
    flags.push('-remote-repo-url', options.remoteRepoUrl);
  }

  return flags;
}

function createConfig(options: TestConfig): string {
  try {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-'));
    const tempConfig = path.join(tempDir, 'config.json');

    const configData = JSON.stringify({
      org: options.orgSettings.meta.org,
      apiUrl: config.API,
      apiAuth: getAuthHeader(),
      allowAnalytics: allowAnalytics(),
      policy: options.policy,
      customSeverities: options.orgSettings.customPolicies,
    });

    fs.writeFileSync(tempConfig, configData);

    return tempConfig;
  } catch (e) {
    throw new ScanError(`unable to create config file: ${e}`);
  }
}

function deleteConfig(configPath) {
  try {
    rimraf.sync(path.dirname(configPath));
  } catch (e) {
    debug('unable to delete temporary directory', e);
  }
}

class ScanError extends CustomError {
  constructor(message: string) {
    super(message);
    this.code = IaCErrorCodes.PolicyEngineScanError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = 'An error occurred when running the scan';
  }
}
