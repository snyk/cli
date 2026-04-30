import { SpawnOptionsWithoutStdio } from 'child_process';
import { spawn } from 'cross-spawn';

type RunCommandResult = {
  code: number;
  stdout: string;
  stderr: string;
  stdoutBuffer?: Buffer;
  stderrBuffer?: Buffer;
};

// bufferOutput sets the RunCommandResult stdoutBuffer and stderrBuffer
// useful if the stdout or stderr string output is too large for the v8 engine
type RunCommandOptions = SpawnOptionsWithoutStdio & {
  bufferOutput?: boolean;
  logErrors?: boolean;
};

/** Suppress url.parse / spawn-shell deprecation noise in child Node processes (Node 24+). */
export function withNodeDeprecationWarningSuppressions<
  T extends Record<string, string | undefined>,
>(env: T): T {
  let nodeOpts = (env.NODE_OPTIONS || '').trim();
  if (!nodeOpts.includes('--disable-warning=DEP0169')) {
    nodeOpts = `${nodeOpts} --disable-warning=DEP0169`.trim();
  }
  if (!nodeOpts.includes('--disable-warning=DEP0190')) {
    nodeOpts = `${nodeOpts} --disable-warning=DEP0190`.trim();
  }
  if (nodeOpts === (env.NODE_OPTIONS || '').trim()) {
    return env;
  }
  return { ...env, NODE_OPTIONS: nodeOpts };
}

/** Remove Node deprecation blocks from captured stderr (belt-and-suspenders if NODE_OPTIONS does not propagate). */
export function stripNodeDeprecationWarnings(stderr: string): string {
  if (!stderr) {
    return stderr;
  }
  const out = stderr
    .replace(
      /\s*\(node:\d+\) \[DEP\d+\] DeprecationWarning:[\s\S]*?\(Use `[^`]*` to show where the warning was created\)[^\n]*/g,
      '',
    )
    .replace(
      /\s*\(node:\d+\) \[DEP[^\]]+\] DeprecationWarning:[^\r\n]+(?:\r?\n\s*\(Use `[^`]*`[^\r\n]+\))?\r?\n?/g,
      '',
    )
    // Deprecation blocks often leave an extra blank line; keep a single leading newline for assertions that expect it.
    .replace(/^\n{2,}/, '\n');

  if (/^\s*$/.test(out)) {
    return '';
  }
  return out;
}

const runCommand = (
  command: string,
  args: string[],
  options?: RunCommandOptions,
): Promise<RunCommandResult> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.on('error', (error) => {
      reject(error);
    });

    child.stdout.on('data', (chunk) => {
      stdout.push(Buffer.from(chunk));
    });

    child.stderr.on('data', (chunk) => {
      stderr.push(Buffer.from(chunk));
    });

    child.on('close', (code) => {
      const result: RunCommandResult = {
        code: code || 0,
        stdout: '',
        stderr: '',
      };

      if (options?.bufferOutput) {
        result.stdoutBuffer = Buffer.concat(stdout);
        result.stderrBuffer = Buffer.concat(stderr);
      } else {
        result.stdout = Buffer.concat(stdout).toString('utf-8');
        result.stderr = Buffer.concat(stderr).toString('utf-8');
      }

      // Strip Node.js deprecation warnings that leak to stderr on Node 24+
      // from transitive dependencies we don't control.
      // 1) Block + optional "(Use `…` --trace-deprecation…)" line (e.g. DEP0169).
      // 2) Single-line warnings (e.g. DEP0190) often have no trace line in captured stderr.
      if (result.stderr) {
        result.stderr = stripNodeDeprecationWarnings(result.stderr);
      }

      if (options?.logErrors && result.code !== 0) {
        console.log('stderr:', result.stderr);
      }

      resolve(result);
    });
  });
};

export { runCommand, RunCommandResult, RunCommandOptions };
