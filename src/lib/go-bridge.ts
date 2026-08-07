import { CLI } from '@snyk/error-catalog-nodejs-public';
import * as childProcess from 'child_process';
import { debug as Debug } from 'debug';
import { StringDecoder } from 'string_decoder';
import { abridgeErrorMessage } from './error-format';

const debug = Debug('snyk:go-bridge');

const SNYK_INTERNAL_CLI_EXECUTABLE_PATH_ENV =
  'SNYK_INTERNAL_CLI_EXECUTABLE_PATH';
const MAX_BUFFER = 50 * 1024 * 1024;
const GO_BRIDGE_STDERR_PREFIX = '[go-bridge] ';
const STDERR_TRUNCATION_ELLIPSIS = ' ...(stderr truncated) ... ';

interface PrefixedChunkResult {
  chunk: string;
  isAtLineStart: boolean;
}

export interface GoCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Executes a subcommand on the Go CLI binary and returns the result.
 *
 * The Go binary path is read from the SNYK_INTERNAL_CLI_EXECUTABLE_PATH environment
 * variable, which is set by the Go wrapper when it spawns the TypeScript CLI.
 *
 * The promise always resolves with a {@link GoCommandResult} containing the
 * exitCode, stdout, and stderr — even for non-zero exit codes. This allows
 * consumers to inspect the result and decide how to handle failures.
 *
 * The promise only rejects for infrastructure/environment errors:
 * - SNYK_INTERNAL_CLI_EXECUTABLE_PATH is not set
 * - The child process fails to spawn (e.g., binary not found)
 * - stdout exceeds the maximum buffer size
 *
 * stderr output is soft-capped: once it reaches the maximum buffer size, it is
 * truncated with an ellipsis marker and no further stderr is accumulated.
 *
 * @param args - The arguments to pass to the Go Snyk CLI binary (e.g., ['depgraph', '--file=uv.lock'])
 * @param options - Optional settings for the child process
 * @returns A result object with the exitCode, stdout, and stderr
 * @throws If SNYK_INTERNAL_CLI_EXECUTABLE_PATH is not set, or the process fails to spawn
 */
export function execGoCommand(
  args: string[],
  options?: { cwd?: string },
): Promise<GoCommandResult> {
  const execPath = process.env[SNYK_INTERNAL_CLI_EXECUTABLE_PATH_ENV];
  if (!execPath) {
    return Promise.reject(
      new CLI.GeneralCLIFailureError(
        `${SNYK_INTERNAL_CLI_EXECUTABLE_PATH_ENV} is not set. ` +
          'The Go CLI binary path is not available in this context.',
      ),
    );
  }

  debug('executing Go command: %s %s', execPath, args.join(' '));
  const shouldStreamStderr = args.includes('--debug');
  const commandEnv = restoreSystemEnvironment({
    ...process.env,
  });

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let stderrSize = 0;
    let isStderrTruncated = false;
    let isStderrAtLineStart = true;
    const stderrDecoder = new StringDecoder('utf8');

    const appendStderrChunk = (stderrChunk: string): void => {
      if (!stderrChunk) {
        return;
      }

      if (shouldStreamStderr) {
        const result = prefixChunkLines(
          stderrChunk,
          GO_BRIDGE_STDERR_PREFIX,
          isStderrAtLineStart,
        );
        isStderrAtLineStart = result.isAtLineStart;
        process.stderr.write(result.chunk);
      }

      if (isStderrTruncated) {
        return;
      }

      const stderrChunkSize = Buffer.byteLength(stderrChunk, 'utf8');
      if (stderrSize + stderrChunkSize > MAX_BUFFER) {
        stderr = abridgeErrorMessage(
          `${stderr}${stderrChunk}`,
          MAX_BUFFER,
          STDERR_TRUNCATION_ELLIPSIS,
        );
        stderrSize = Buffer.byteLength(stderr, 'utf8');
        isStderrTruncated = true;
        return;
      }

      stderr += stderrChunk;
      stderrSize += stderrChunkSize;
    };

    const proc = childProcess.spawn(execPath, args, {
      cwd: options?.cwd,
      env: commandEnv,
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
      proc.stderr.on('data', (data: Buffer | string) => {
        const stderrChunk =
          typeof data === 'string' ? data : stderrDecoder.write(data);
        appendStderrChunk(stderrChunk);
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
      const trailingStderrChunk = stderrDecoder.end();
      appendStderrChunk(trailingStderrChunk);

      debug('Go command exited with code %d', code);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

function restoreSystemEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  // The parent Go process injects a fake SNYK_TOKEN as "random" into the
  // TypeScript CLI environment to bypass legacy auth checks. When re-invoking
  // the Go binary, this token tricks the child cli call into disabling OAuth and
  // attempting API-token auth, which fails. Removing it lets the child cli to
  // authenticate via config/keyring like a normal CLI invocation.
  if (env.SNYK_TOKEN === 'random') {
    delete env.SNYK_TOKEN;
  }

  if (process.env.SNYK_SYSTEM_HTTP_PROXY != undefined) {
    env.HTTP_PROXY = process.env.SNYK_SYSTEM_HTTP_PROXY;
  }
  if (process.env.SNYK_SYSTEM_HTTPS_PROXY != undefined) {
    env.HTTPS_PROXY = process.env.SNYK_SYSTEM_HTTPS_PROXY;
  }
  if (process.env.SNYK_SYSTEM_NO_PROXY != undefined) {
    env.NO_PROXY = process.env.SNYK_SYSTEM_NO_PROXY;
  }
  if (process.env.SNYK_SYSTEM_OPENSSL_CONF != undefined) {
    env.OPENSSL_CONF = process.env.SNYK_SYSTEM_OPENSSL_CONF;
  }
  return env;
}

function prefixChunkLines(
  chunk: string,
  prefix: string,
  isAtLineStart: boolean,
): PrefixedChunkResult {
  if (!chunk) {
    return { chunk, isAtLineStart };
  }

  const prefixedChunkBody = chunk.replace(/\n(?!$)/g, `\n${prefix}`);
  return {
    chunk: isAtLineStart ? `${prefix}${prefixedChunkBody}` : prefixedChunkBody,
    isAtLineStart: chunk.endsWith('\n'),
  };
}
