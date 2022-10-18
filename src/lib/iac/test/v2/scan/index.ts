import { TestConfig } from '../types';
import * as childProcess from 'child_process';
import { CustomError } from '../../../../errors';
import { IaCErrorCodes } from '../../../../../cli/commands/test/iac/local-execution/types';
import { getErrorStringCode } from '../../../../../cli/commands/test/iac/local-execution/error-utils';
import * as newDebug from 'debug';
import { mapSnykIacTestOutputToTestOutput, TestOutput } from './results';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import config from '../../../../config';
import { api } from '../../../../api-token';
import { allowAnalytics } from '../../../../analytics';
import envPaths from 'env-paths';

const debug = newDebug('snyk-iac');

export const systemCachePath = config.CACHE_PATH ?? envPaths('snyk').cache;

export function scan(
  options: TestConfig,
  policyEnginePath: string,
  rulesBundlePath: string,
): TestOutput {
  const {
    tempOutput: outputPath,
    tempDir: tempDirPath,
    tempPolicy: tempPolicyPath,
  } = createTemporaryFiles(options);
  try {
    return scanWithConfig(
      options,
      policyEnginePath,
      rulesBundlePath,
      outputPath,
      tempPolicyPath,
    );
  } finally {
    deleteTemporaryFiles(tempDirPath);
  }
}

function scanWithConfig(
  options: TestConfig,
  policyEnginePath: string,
  rulesBundlePath: string,
  outputPath: string,
  policyPath: string,
): TestOutput {
  const env = { ...process.env };

  env['SNYK_API_URL'] = getApiUrl();
  env['SNYK_API_TOKEN'] = getApiToken();

  const args = processFlags(options, rulesBundlePath, outputPath, policyPath);

  args.push(...options.paths);

  const child = childProcess.spawnSync(policyEnginePath, args, {
    encoding: 'utf-8',
    stdio: 'pipe',
    env: env,
    maxBuffer: 1024 * 1024 * 10, // The default value is 1024 * 1024, if we see in the future that multiplying it by 10 is not enough we can increase it further.
  });

  debug('policy engine standard error:\n%s', '\n' + child.stderr);

  if (child.status && child.status !== 0) {
    throw new ScanError(`invalid exit status: ${child.status}`);
  }

  if (child.error) {
    throw new ScanError(`spawning process: ${child.error}`);
  }

  let snykIacTestOutput: string, parsedSnykIacTestOutput;

  try {
    snykIacTestOutput = fs.readFileSync(outputPath, 'utf-8');
    parsedSnykIacTestOutput = JSON.parse(snykIacTestOutput);
  } catch (e) {
    throw new ScanError(`invalid output encoding: ${e}`);
  }

  return mapSnykIacTestOutputToTestOutput(parsedSnykIacTestOutput);
}

function processFlags(
  options: TestConfig,
  rulesBundlePath: string,
  outputPath: string,
  policyPath: string,
) {
  const flags = [
    '-cache-dir',
    systemCachePath,
    '-bundle',
    rulesBundlePath,
    '-policy',
    policyPath,
  ];

  flags.push('-output', outputPath);

  if (options.severityThreshold) {
    flags.push('-severity-threshold', options.severityThreshold);
  }

  if (options.depthDetection) {
    flags.push('-depth-detection', `${options.depthDetection}`);
  }

  if (options.report && allowAnalytics()) {
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

  if (options.varFile) {
    flags.push('-var-file', options.varFile);
  }

  if (options.cloudContext) {
    flags.push('-cloud-context', options.cloudContext);
  }

  if (options.insecure) {
    flags.push('-http-tls-skip-verify');
  }

  if (options.org) {
    flags.push('-org', options.org);
  }

  return flags;
}

function createTemporaryFiles(
  options: TestConfig,
): {
  tempOutput: string;
  tempDir: string;
  tempPolicy: string;
} {
  try {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-'));
    const tempOutput = path.join(tempDir, 'output.json');
    const tempPolicy = path.join(tempDir, '.snyk');

    fs.writeFileSync(tempOutput, '');
    fs.writeFileSync(tempPolicy, options.policy || '');

    return { tempOutput, tempDir, tempPolicy };
  } catch (e) {
    throw new ScanError(`unable to create config/output file: ${e}`);
  }
}

function deleteTemporaryFiles(tempDirPath: string) {
  try {
    rimraf.sync(tempDirPath);
  } catch (e) {
    debug('unable to delete temporary directory', e);
  }
}

function getApiUrl() {
  return config.API_REST_URL;
}

function getApiToken() {
  return api() || '';
}

class ScanError extends CustomError {
  constructor(message: string) {
    super(message);
    this.code = IaCErrorCodes.PolicyEngineScanError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = 'An error occurred when running the scan';
  }
}
