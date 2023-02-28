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
import { api, getOAuthToken } from '../../../../api-token';
import envPaths from 'env-paths';
import { restoreEnvProxy } from '../../../env-utils';

const debug = newDebug('snyk-iac');

export const systemCachePath = config.CACHE_PATH ?? envPaths('snyk').cache;

export async function scan(
  options: TestConfig,
  policyEnginePath: string,
  rulesBundlePath: string,
): Promise<TestOutput> {
  const {
    tempOutput: outputPath,
    tempDir: tempDirPath,
    tempPolicy: tempPolicyPath,
  } = await createTemporaryFiles(options);
  try {
    return await scanWithConfig(
      options,
      policyEnginePath,
      rulesBundlePath,
      outputPath,
      tempPolicyPath,
    );
  } finally {
    await deleteTemporaryFiles(tempDirPath);
  }
}

async function scanWithConfig(
  options: TestConfig,
  policyEnginePath: string,
  rulesBundlePath: string,
  outputPath: string,
  policyPath: string,
): Promise<TestOutput> {
  const env = { ...process.env };

  env['SNYK_IAC_TEST_API_REST_URL'] =
    process.env['SNYK_IAC_TEST_API_REST_URL'] || getApiUrl();
  env['SNYK_IAC_TEST_API_REST_TOKEN'] =
    process.env['SNYK_IAC_TEST_API_REST_TOKEN'] || getApiToken();
  env['SNYK_IAC_TEST_API_REST_OAUTH_TOKEN'] =
    process.env['SNYK_IAC_TEST_API_REST_OAUTH_TOKEN'] || getOAuthToken();
  env['SNYK_IAC_TEST_API_V1_URL'] =
    process.env['SNYK_IAC_TEST_API_V1_URL'] || getApiUrl();
  env['SNYK_IAC_TEST_API_V1_TOKEN'] =
    process.env['SNYK_IAC_TEST_API_V1_TOKEN'] || getApiToken();
  env['SNYK_IAC_TEST_API_V1_OAUTH_TOKEN'] =
    process.env['SNYK_IAC_TEST_API_V1_OAUTH_TOKEN'] || getOAuthToken();

  const args = processFlags(options, rulesBundlePath, outputPath, policyPath);

  args.push(...options.paths);

  const child = await spawn(policyEnginePath, args, env);

  debug('policy engine standard error:\n%s', '\n' + child.stderr);

  if (child.status && child.status !== 0) {
    throw new ScanError(`invalid exit status: ${child.status}`);
  }

  if (child.error) {
    throw new ScanError(`spawning process: ${child.error}`);
  }

  return mapSnykIacTestOutputToTestOutput(await readJson(outputPath));
}

async function readJson(path: string) {
  try {
    return JSON.parse(await readFile(path));
  } catch (e) {
    throw new ScanError(`invalid output encoding: ${e}`);
  }
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

  if (options.varFile) {
    flags.push('-var-file', options.varFile);
  }

  if (options.cloudContext) {
    flags.push('-cloud-context', options.cloudContext);
  }

  if (options.snykCloudEnvironment) {
    flags.push('-snyk-cloud-environment', options.snykCloudEnvironment);
  }

  if (options.insecure) {
    flags.push('-http-tls-skip-verify');
  }

  if (options.org) {
    flags.push('-org', options.org);
  }

  if (options.customRules) {
    if (options.experimental) {
      flags.push('-custom-rules');
    } else {
      debug(
        '--custom-rules specified without --experimental. ignoring --custom-rules.',
      );
    }
  }

  return flags;
}

interface TemporaryFilesResult {
  tempOutput: string;
  tempDir: string;
  tempPolicy: string;
}

async function createTemporaryFiles(
  options: TestConfig,
): Promise<TemporaryFilesResult> {
  try {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'snyk-'));
    const tempOutput = path.join(tempDir, 'output.json');
    const tempPolicy = path.join(tempDir, '.snyk');

    await writeFile(tempPolicy, options.policy || '');

    return { tempOutput, tempDir, tempPolicy };
  } catch (e) {
    throw new ScanError(`unable to create config/output file: ${e}`);
  }
}

async function deleteTemporaryFiles(tempDirPath: string) {
  try {
    await remove(tempDirPath);
  } catch (e) {
    debug('unable to delete temporary directory', e);
  }
}

async function mkdtemp(path: string) {
  return new Promise<string>((resolve, reject) => {
    fs.mkdtemp(path, (err, folder) => {
      if (err) {
        reject(err);
      } else {
        resolve(folder);
      }
    });
  });
}

async function writeFile(path: string, content: string) {
  return new Promise<void>((resolve, reject) => {
    fs.writeFile(path, content, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function readFile(path: string) {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(path, 'utf-8', (err, content) => {
      if (err) {
        reject(err);
      } else {
        resolve(content);
      }
    });
  });
}

async function remove(path: string) {
  return new Promise((resolve, reject) => {
    rimraf(path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function getApiUrl() {
  return config.API_REST_URL;
}

function getApiToken() {
  return api() || '';
}

interface SpawnResult {
  stdout: Buffer;
  stderr: Buffer;
  status: number | null;
  error?: Error;
}

async function spawn(
  path: string,
  args: string[],
  env: Record<string, string | undefined>,
) {
  return new Promise<SpawnResult>((resolve) => {
    env = restoreEnvProxy(env);

    const child = childProcess.spawn(path, args, {
      stdio: 'pipe',
      env: env,
    });

    const stdout: Buffer[] = [];

    child.stdout.on('data', (data) => {
      stdout.push(Buffer.from(data));
    });

    const stderr: Buffer[] = [];

    child.stderr.on('data', (data) => {
      stderr.push(Buffer.from(data));
    });

    // If 'error' is emitted, 'exit' might or might not be emitted, too. The
    // 'returned' flag prevents the promise from being resolved twice if an
    // error occurs.

    let returned = false;

    child.on('exit', (status) => {
      if (returned) {
        return;
      }

      returned = true;

      resolve({
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        status,
      });
    });

    child.on('error', (error) => {
      if (returned) {
        return;
      }

      returned = true;

      resolve({
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        status: null,
        error,
      });
    });
  });
}

class ScanError extends CustomError {
  constructor(message: string) {
    super(message);
    this.code = IaCErrorCodes.PolicyEngineScanError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = 'An error occurred when running the scan';
  }
}
