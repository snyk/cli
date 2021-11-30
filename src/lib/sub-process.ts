import childProcess from 'child_process';

export function execute(
  command: string,
  args: string[],
  options?: { cwd: string },
): Promise<string> {
  const spawnOptions: childProcess.SpawnOptions = { shell: true };
  if (options && options.cwd) {
    spawnOptions.cwd = options.cwd;
  }

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = childProcess.spawn(command, args, spawnOptions);
    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data;
      });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data;
      });
    }

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(stdout || stderr);
      }
      resolve(stdout || stderr);
    });
  });
}
