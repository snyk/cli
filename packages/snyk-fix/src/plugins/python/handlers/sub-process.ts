import { spawn, SpawnOptions } from 'child_process';

export interface ExecuteResponse {
  exitCode: number;
  stderr: string;
  stdout: string;
  error?: any;
  command: string;
  duration: number;
}

// Executes a subprocess.
// Resolves successfully on exit code 0 with all the info
// available
export async function execute(
  command: string,
  args: string[],
  options: { cwd?: string },
): Promise<ExecuteResponse> {
  const spawnOptions: SpawnOptions = {
    shell: true,
    detached: true, // do not send signals to child processes
  };
  if (options && options.cwd) {
    spawnOptions.cwd = options.cwd;
  }
  const fullCommand = `${command} ${args.join(' ')}`;
  let worker;

  try {
    const startTime = Date.now();
    worker = spawn(command, args, options);

    return await new Promise((resolve, reject) => {
      let stderr = '';
      let stdout = '';

      worker.stdout.on('data', (data) => {
        stdout += data;
      });
      worker.stderr.on('data', (data) => {
        stderr += data;
      });
      worker.on('error', (e) => {
        reject({
          stderr,
          stdout,
          error: e,
          duration: Date.now() - startTime,
          command: fullCommand,
        });
      });
      worker.on('exit', (code) => {
        if (code > 0) {
          resolve({
            stderr,
            stdout,
            duration: Date.now() - startTime,
            command: fullCommand,
            exitCode: code,
          });
        } else {
          resolve({
            stderr,
            stdout,
            duration: Date.now() - startTime,
            command: fullCommand,
            exitCode: code,
          });
        }
      });
    });
  } finally {
    // Additional anti-zombie protection. Process here should be already stopped.
    try {
      process.kill(worker.pid, 'SIGKILL');
    } catch (e) {
      // Process already stopped.
    }
  }
}
