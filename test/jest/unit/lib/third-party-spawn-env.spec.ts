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
    HTTP_PROXY: env?.HTTP_PROXY,
    http_proxy: env?.http_proxy,
    MY_CONTROL_VAR: env?.MY_CONTROL_VAR,
  };
}

const EXPECTED_THIRD_PARTY_ENV = {
  snykKeys: [],
  HTTP_PROXY: USER_HTTP_PROXY,
  http_proxy: USER_HTTP_PROXY,
  MY_CONTROL_VAR: 'kept',
};

function expectCleanThirdPartyEnv(env: NodeJS.ProcessEnv | undefined): void {
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

  it('subProcess.execute passes a cleaned env to spawn', async () => {
    const spawnSpy = mockSpawnClose();

    await subProcessExecute('git', ['rev-parse'], { cwd: '/tmp' });

    expectCleanThirdPartyEnv(spawnSpy.mock.calls[0][2]?.env);
  });

  it('subProcess.execute keeps the user proxy when the CLI internal proxy has credentials', async () => {
    process.env.HTTP_PROXY = 'http://snyk:secret@127.0.0.1:1234';
    const spawnSpy = mockSpawnClose();

    await subProcessExecute('git', ['rev-parse'], { cwd: '/tmp' });

    const env = spawnSpy.mock.calls[0][2]?.env as NodeJS.ProcessEnv;
    expect(env.HTTP_PROXY).toBe(USER_HTTP_PROXY);
    expect(env.http_proxy).toBe(USER_HTTP_PROXY);
    expect(env.HTTP_PROXY).not.toContain('secret');
    expect(env.http_proxy).not.toContain('secret');
  });

  it('executeCommand passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    executeCommand('git status', '/tmp');

    expectCleanThirdPartyEnv(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('npm passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    await npm('install', ['left-pad'], true, '/tmp', null);

    expectCleanThirdPartyEnv(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('npm getVersion passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    await npmGetVersion();

    expectCleanThirdPartyEnv(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('yarn passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    await yarn('add', ['left-pad'], true, '/tmp', []);

    expectCleanThirdPartyEnv(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('execShell passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    await execShell('git log', '/tmp');

    expectCleanThirdPartyEnv(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('isInstalled passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    await isInstalled('git');

    expectCleanThirdPartyEnv(optionsArg(execSpy.mock.calls[0])?.env);
  });

  it('copy passes a cleaned env to execSync', () => {
    const execSyncSpy = jest
      .spyOn(childProcess, 'execSync')
      .mockReturnValue(Buffer.from(''));

    copy('text');

    expectCleanThirdPartyEnv(optionsArg(execSyncSpy.mock.calls[0])?.env);
  });

  it('getRepositoryRoot passes a cleaned env to spawnSync', () => {
    const spawnSyncSpy = jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
      status: 0,
      stdout: Buffer.from('/repo\n'),
    } as any);

    getRepositoryRoot('/tmp');

    expectCleanThirdPartyEnv(spawnSyncSpy.mock.calls[0][2]?.env);
  });
});
