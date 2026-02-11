import * as childProcess from 'child_process';
import { CLI } from '@snyk/error-catalog-nodejs-public';
import { debug as Debug } from 'debug';

const debug = Debug('snyk:go-bridge');

const SNYK_CLI_EXECUTABLE_PATH_ENV = 'SNYK_CLI_EXECUTABLE_PATH';
const MAX_BUFFER = 50 * 1024 * 1024;

export interface GoCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Executes a subcommand on the Go CLI binary and returns the result.
 *
 * The Go binary path is read from the SNYK_CLI_EXECUTABLE_PATH environment
 * variable, which is set by the Go wrapper when it spawns the TypeScript CLI.
 *
 * The promise always resolves with a {@link GoCommandResult} containing the
 * exitCode, stdout, and stderr — even for non-zero exit codes. This allows
 * consumers to inspect the result and decide how to handle failures.
 *
 * The promise only rejects for infrastructure/environment errors:
 * - SNYK_CLI_EXECUTABLE_PATH is not set
 * - The child process fails to spawn (e.g., binary not found)
 * - stdout exceeds the maximum buffer size
 *
 * @param args - The arguments to pass to the Go Snyk CLI binary (e.g., ['depgraph', '--file=uv.lock'])
 * @param options - Optional settings for the child process
 * @returns A result object with the exitCode, stdout, and stderr
 * @throws If SNYK_CLI_EXECUTABLE_PATH is not set, or the process fails to spawn
 */
export function execGoCommand(
  args: string[],
  options?: { cwd?: string },
): Promise<GoCommandResult> {
  const execPath = process.env[SNYK_CLI_EXECUTABLE_PATH_ENV];
  if (!execPath) {
    return Promise.reject(
      new CLI.GeneralCLIFailureError(
        `${SNYK_CLI_EXECUTABLE_PATH_ENV} is not set. ` +
          'The Go CLI binary path is not available in this context.',
      ),
    );
  }

  debug('executing Go command: %s %s', execPath, args.join(' '));

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = childProcess.spawn(execPath, args, {
      cwd: options?.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (proc.stdout) {
      proc.stdout.on('data', (data: Buffer) => {
        stdout += data;
        if (stdout.length > MAX_BUFFER) {
          proc.kill();
          reject(
            new CLI.GeneralCLIFailureError(
              `Go command output exceeded maximum buffer size (${MAX_BUFFER} bytes)`,
            ),
          );
        }
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => {
        stderr += data;
      });
    }

    proc.on('error', (err) => {
      debug('Go command spawn error: %s', err.message);
      reject(
        new CLI.GeneralCLIFailureError(
          `Failed to execute Go CLI: ${err.message}`,
        ),
      );
    });

    proc.on('close', (code) => {
      debug('Go command exited with code %d', code);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}
