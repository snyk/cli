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

const callSites: [string, () => unknown][] = [
  ['executeCommand', () => executeCommand('git status', '/tmp')],
  ['npm', () => npm('install', ['left-pad'], true, '/tmp', null)],
  ['npm getVersion', () => npmGetVersion()],
  ['yarn', () => yarn('add', ['left-pad'], true, '/tmp', [])],
  [
    'subProcess.execute',
    () => subProcessExecute('git', ['rev-parse'], { cwd: '/tmp' }),
  ],
  ['execShell', () => execShell('git log', '/tmp')],
  ['isInstalled', () => isInstalled('git')],
  ['copy', () => copy('text')],
  ['getRepositoryRoot', () => getRepositoryRoot('/tmp')],
];

describe('third-party child processes', () => {
  const originalEnv = process.env;
  let spies: jest.SpyInstance[];

  function envPassedToChildProcess(): NodeJS.ProcessEnv {
    const options = spies
      .flatMap((spy) => spy.mock.calls.flat())
      .find(
        (arg): arg is { env: NodeJS.ProcessEnv } =>
          typeof arg === 'object' &&
          arg !== null &&
          !Array.isArray(arg) &&
          'env' in arg,
      );
    if (!options) {
      throw new Error('no child process was started with an env');
    }
    return options.env;
  }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SNYK_TOKEN: 'real-api-token-value',
    };
    spies = [
      jest.spyOn(childProcess, 'exec').mockImplementation(((
        ...args: unknown[]
      ) => {
        const callback = args[args.length - 1] as (
          err: null,
          stdout: string,
          stderr: string,
        ) => void;
        callback(null, 'ok', '');
        return {} as childProcess.ChildProcess;
      }) as any),
      jest.spyOn(childProcess, 'execSync').mockReturnValue(Buffer.from('')),
      jest.spyOn(childProcess, 'spawn').mockImplementation((() => {
        const proc = new EventEmitter();
        setImmediate(() => proc.emit('close', 0));
        return proc;
      }) as any),
      jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
        status: 0,
        stdout: Buffer.from('/repo\n'),
      } as any),
    ];
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it.each(callSites)('%s passes no SNYK_* variables', async (_name, run) => {
    await run();

    const env = envPassedToChildProcess();
    expect(Object.keys(env).filter((key) => /^snyk_/i.test(key))).toEqual([]);
  });
});
