import * as path from 'path';
import { RunCommandOptions, runCommand } from '../../util/runCommand';
import { getFixturePath } from '../../util/getFixturePath';
import * as os from 'os';
import * as fs from 'fs';

/**
 * This module cannot be unit tested as it hooks onto the current process where
 * errors are handled by Jest; so its error handling will never trigger.
 *
 * Since these are "unexpected" errors which we aren't aware of and shouldn't
 * have, there's no failure scenario for it within Snyk CLI either.
 *
 * So we're testing it by launching separate standalone scripts in their own
 * NodeJS process.
 */
describe('callHandlingUnexpectedErrors', () => {
  async function runScript(filename: string, env?: NodeJS.ProcessEnv) {
    const file = path.resolve(getFixturePath('unexpected-error'), filename);

    let environment = {
      FORCE_COLOR: '0',
      PATH: process.env.PATH,
    };

    if (env) {
      environment = {
        ...environment,
        ...env,
      };
    }

    const options: RunCommandOptions = {
      env: environment,
    };
    return runCommand('node', ['-r', 'ts-node/register', file], options);
  }

  it('calls the provided callable', async () => {
    const { code, stdout, stderr } = await runScript('resolvedPromise.ts');
    expect(stderr).toEqual('');
    expect(stdout).toEqual('Result: resolvedPromise\n');
    expect(code).toEqual(0);
  });

  it('exits when provided callable rejects', async () => {
    const { code, stdout, stderr } = await runScript('rejectedPromise.ts');
    expect(stderr).toMatch(
      'Something unexpected went wrong: Error: rejectedPromise',
    );
    expect(stderr).toMatch('Exit code: 2');
    expect(stdout).toEqual('');
    expect(code).toEqual(2);
  });

  it('exits on uncaughtException', async () => {
    const { code, stdout, stderr } = await runScript('uncaughtException.ts');
    expect(stderr).toMatch(
      'Something unexpected went wrong: Error: uncaughtException',
    );
    expect(stderr).toMatch('Exit code: 2');
    expect(stdout).toEqual('');
    expect(code).toEqual(2);
  });

  it('exits on unhandledRejection', async () => {
    const { code, stdout, stderr } = await runScript('unhandledRejection.ts');
    expect(stderr).toMatch(
      'Something unexpected went wrong: Error: unhandledRejection',
    );
    expect(stderr).toMatch('Exit code: 2');
    expect(stdout).toEqual('');
    expect(code).toEqual(2);
  });

  it('write unhandled exception to error file', async () => {
    const errorDir = path.join(os.tmpdir(), 'unhandledException');
    const errorFile = path.join(errorDir, 'error.txt');
    fs.mkdirSync(errorDir, {
      recursive: true,
    });

    const { code, stdout, stderr } = await runScript('unhandledRejection.ts', {
      SNYK_ERR_FILE: errorFile,
    });

    expect(fs.existsSync(errorFile)).toBeTruthy();
    expect(fs.readFileSync(errorFile).toString()).toContain(
      'unhandledRejection',
    );
    expect(stderr).toEqual('');
    expect(stdout).toEqual('');
    expect(code).toEqual(2);

    fs.rmSync(errorDir, { recursive: true });
  });
});
