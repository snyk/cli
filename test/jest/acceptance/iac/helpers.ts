import * as assert from 'assert';
import { exec } from 'child_process';
import { join } from 'path';
import { fakeServer } from '../../../acceptance/fake-server';

type Lifecycle = (fn: () => Promise<void>, timeout?: number) => Promise<void>;

/**
 * Returns a `run()` function used to evaluate a shell command against the
 * current environment. Will start a fake webserver in the background as part
 * of the test beforeAll lifecycle and will ensure that it is torn down in the
 * afterAll event.
 *
 * Usage:
 *
 *   describe('some test', () => {
 *     const run = setupMockServer(beforeAll, afterAll);
 *
 *     it('runs a command', () => {
 *        const { exitCode } = await run('echo "hello"');
 *        expect(exitCode).toEqual(1);
 *     });
 *   });
 */
export function setupMockServer(
  beforeAll: Lifecycle,
  afterAll: Lifecycle,
): typeof run {
  let env: Record<string, string>;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const result = await startMockServer();
    env = result.env;
    teardown = result.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  return (cmd: string, overrides: Record<string, string> = {}) => {
    assert(env, 'server not yet started, check configuration');
    return run(cmd, { ...env, ...overrides });
  };
}

/**
 * Starts a local version of the fixture webserver and returns
 * two utilities.
 * - `run()` which will execute a terminal command with the environment
 *   variables set.
 * - `teardown()` which will shutdown the server.
 */
export async function startMockServer(): Promise<{
  env: Record<string, string>;
  teardown: () => Promise<void>;
}> {
  const SNYK_TOKEN = '123456789';
  const BASE_API = '/api/v1';
  const server = fakeServer(BASE_API, SNYK_TOKEN);

  // Use port of 0 to find a free port.
  await new Promise((resolve) => server.listen(0, resolve));

  const SNYK_HOST = 'http://localhost:' + server.address().port;
  const SNYK_API = SNYK_HOST + BASE_API;

  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    SNYK_TOKEN,
    SNYK_API,
    SNYK_HOST,
    // Override any local config set via `snyk config set`
    SNYK_CFG_API: SNYK_TOKEN,
    SNYK_CFG_ENDPOINT: SNYK_API,
  };

  return {
    env,
    teardown: async () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * Run a command from within the test/fixtures directory.
 */
export async function run(
  cmd: string,
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const root = join(__dirname, '../../../../');
    const main = join(root, 'dist/cli/index.js');
    const child = exec(
      cmd.trim().replace(/^snyk/, `node ${main}`),
      {
        env,
        cwd: join(root, 'test/fixtures'),
      },
      function(err, stdout, stderr) {
        // err.code indicates the shell exited with non-zero code
        // which is in our case a success and we resolve.
        if (err && typeof err.code !== 'number') {
          reject(err);
        } else {
          if (child.exitCode === null) throw Error();
          resolve({ stderr, stdout, exitCode: child.exitCode });
        }
      },
    );
  });
}
