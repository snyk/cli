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

function thirdPartyEnvSummary(
  env: NodeJS.ProcessEnv | undefined,
): Record<string, unknown> {
  return {
    snykKeys: Object.keys(env ?? {}).filter((key) => /^snyk_/i.test(key)),
    HTTP_PROXY: env?.HTTP_PROXY,
    MY_CONTROL_VAR: env?.MY_CONTROL_VAR,
  };
}

const EXPECTED_THIRD_PARTY_ENV = {
  snykKeys: [],
  HTTP_PROXY: USER_HTTP_PROXY,
  MY_CONTROL_VAR: 'kept',
};

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

describe('third-party child processes do not inherit SNYK_* variables', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SNYK_TOKEN: 'real-api-token-value',
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
    const spawnSpy = jest
      .spyOn(childProcess, 'spawn')
      .mockImplementation((() => {
        const proc = new EventEmitter();
        setImmediate(() => proc.emit('close', 0));
        return proc;
      }) as any);

    await subProcessExecute('git', ['rev-parse'], { cwd: '/tmp' });

    expect(thirdPartyEnvSummary(spawnSpy.mock.calls[0][2]?.env)).toEqual(
      EXPECTED_THIRD_PARTY_ENV,
    );
  });

  it('executeCommand passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    executeCommand('git status', '/tmp');

    expect(
      thirdPartyEnvSummary(optionsArg(execSpy.mock.calls[0])?.env),
    ).toEqual(EXPECTED_THIRD_PARTY_ENV);
  });

  it('npm passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    await npm('install', ['left-pad'], true, '/tmp', null);

    expect(
      thirdPartyEnvSummary(optionsArg(execSpy.mock.calls[0])?.env),
    ).toEqual(EXPECTED_THIRD_PARTY_ENV);
  });

  it('npm getVersion passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    await npmGetVersion();

    expect(
      thirdPartyEnvSummary(optionsArg(execSpy.mock.calls[0])?.env),
    ).toEqual(EXPECTED_THIRD_PARTY_ENV);
  });

  it('yarn passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    await yarn('add', ['left-pad'], true, '/tmp', []);

    expect(
      thirdPartyEnvSummary(optionsArg(execSpy.mock.calls[0])?.env),
    ).toEqual(EXPECTED_THIRD_PARTY_ENV);
  });

  it('execShell passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    await execShell('git log', '/tmp');

    expect(
      thirdPartyEnvSummary(optionsArg(execSpy.mock.calls[0])?.env),
    ).toEqual(EXPECTED_THIRD_PARTY_ENV);
  });

  it('isInstalled passes a cleaned env to exec', async () => {
    const execSpy = mockExecCallback();

    await isInstalled('git');

    expect(
      thirdPartyEnvSummary(optionsArg(execSpy.mock.calls[0])?.env),
    ).toEqual(EXPECTED_THIRD_PARTY_ENV);
  });

  it('copy passes a cleaned env to execSync', () => {
    const execSyncSpy = jest
      .spyOn(childProcess, 'execSync')
      .mockReturnValue(Buffer.from(''));

    copy('text');

    expect(
      thirdPartyEnvSummary(optionsArg(execSyncSpy.mock.calls[0])?.env),
    ).toEqual(EXPECTED_THIRD_PARTY_ENV);
  });

  it('getRepositoryRoot passes a cleaned env to spawnSync', () => {
    const spawnSyncSpy = jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
      status: 0,
      stdout: Buffer.from('/repo\n'),
    } as any);

    getRepositoryRoot('/tmp');

    expect(thirdPartyEnvSummary(spawnSyncSpy.mock.calls[0][2]?.env)).toEqual(
      EXPECTED_THIRD_PARTY_ENV,
    );
  });
});
