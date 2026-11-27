import * as childProcess from 'child_process';
import { EventEmitter } from 'events';

import { executeCommand } from '../../../../src/lib/exec';
import npm, { getVersion as npmGetVersion } from '../../../../src/lib/npm';
import { yarn } from '../../../../src/lib/yarn';
import { execute as subProcessExecute } from '../../../../src/lib/sub-process';
import { copy } from '../../../../src/cli/copy';
import { execShell } from '../../../../src/lib/monitor/dev-count-analysis';
import { isInstalled } from '../../../../src/lib/analytics/sources';
import { getRepositoryRoot } from '../../../../src/lib/iac/git';

const USER_HTTP_PROXY = 'http://user-proxy:8080';
const SECRET_VALUES = [
  'real-api-token-value',
  'lowercase-api-token-value',
  'oauth-token-value',
];

function thirdPartyEnvSummary(
  env: NodeJS.ProcessEnv | undefined,
): Record<string, unknown> {
  return {
    snykKeys: Object.keys(env ?? {}).filter((key) => /^snyk_/i.test(key)),
    MY_CONTROL_VAR: env?.MY_CONTROL_VAR,
  };
}

const EXPECTED_THIRD_PARTY_ENV = {
  snykKeys: [],
  MY_CONTROL_VAR: 'kept',
};

function expectNoSnykVars(env: NodeJS.ProcessEnv | undefined): void {
  expect(thirdPartyEnvSummary(env)).toEqual(EXPECTED_THIRD_PARTY_ENV);
  const serialized = JSON.stringify(env ?? {});
  for (const secret of SECRET_VALUES) {
    expect(serialized).not.toContain(secret);
  }
}

function optionsArg(args: unknown[]): childProcess.ExecOptions {
  return args.find(
    (arg) => arg !== null && typeof arg === 'object' && !Array.isArray(arg),
  ) as childProcess.ExecOptions;
}

function mockExecCallback(): jest.SpyInstance {
  return jest.spyOn(childProcess, 'exec').mockImplementation(((
    ...args: unknown[]
  ) => {
    const callback = args[args.length - 1] as (
      err: null,
      stdout: string,
      stderr: string,
    ) => void;
    callback(null, 'ok', '');
    return {} as childProcess.ChildProcess;
  }) as any);
}

function mockSpawnClose(): jest.SpyInstance {
  return jest.spyOn(childProcess, 'spawn').mockImplementation((() => {
    const proc = new EventEmitter();
    setImmediate(() => proc.emit('close', 0));
    return proc;
  }) as any);
}

describe('third-party child processes do not inherit SNYK_* variables', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SNYK_TOKEN: 'real-api-token-value',
      snyk_token: 'lowercase-api-token-value',
      SNYK_OAUTH_TOKEN: 'oauth-token-value',
      SNYK_API: 'https://api.snyk.io',
      SNYK_SYSTEM_HTTP_PROXY: USER_HTTP_PROXY,
      HTTP_PROXY: 'http://go-proxy:9000',
      MY_CONTROL_VAR: 'kept',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('subProcess.execute passes an env without SNYK_* to spawn', async () => {
    const spawnSpy = mockSpawnClose();

    await subProcessExecute('git', ['rev-parse'], { cwd: '/tmp' });

    expectNoSnykVars(spawnSpy.mock.calls[0][2]?.env);
  });

  it('executeCommand passes an env without SNYK_* to exec', async () => {
    const execSpy = mockExecCallback();

    executeCommand('git status', '/tmp');

    expectNoSnykVars(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('npm passes an env without SNYK_* to exec', async () => {
    const execSpy = mockExecCallback();

    await npm('install', ['left-pad'], true, '/tmp', null);

    expectNoSnykVars(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('npm getVersion passes an env without SNYK_* to exec', async () => {
    const execSpy = mockExecCallback();

    await npmGetVersion();

    expectNoSnykVars(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('yarn passes an env without SNYK_* to exec', async () => {
    const execSpy = mockExecCallback();

    await yarn('add', ['left-pad'], true, '/tmp', []);

    expectNoSnykVars(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('execShell passes an env without SNYK_* to exec', async () => {
    const execSpy = mockExecCallback();

    await execShell('git log', '/tmp');

    expectNoSnykVars(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('isInstalled passes an env without SNYK_* to exec', async () => {
    const execSpy = mockExecCallback();

    await isInstalled('git');

    expectNoSnykVars(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('copy passes an env without SNYK_* to execSync', () => {
    const execSyncSpy = jest
      .spyOn(childProcess, 'execSync')
      .mockReturnValue(Buffer.from(''));

    copy('text');

    expectNoSnykVars(optionsArg(execSyncSpy.mock.calls[0])?.env);
  });

  it('getRepositoryRoot passes an env without SNYK_* to spawnSync', () => {
    const spawnSyncSpy = jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
      status: 0,
      stdout: Buffer.from('/repo\n'),
    } as any);

    getRepositoryRoot('/tmp');

    expectNoSnykVars(spawnSyncSpy.mock.calls[0][2]?.env);
  });
});
