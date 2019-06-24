const childProcess = require('child_process');

module.exports.execute = function (command, args, options) {
  const spawnOptions = {shell: true};
  if (options && options.cwd) {
    spawnOptions.cwd = options.cwd;
  }

  return new Promise(((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = childProcess.spawn(command, args, spawnOptions);
    proc.stdout.on('data', (data) => {
      stdout = stdout + data;
    });
    proc.stderr.on('data', (data) => {
      stderr = stderr + data;
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(stdout || stderr);
      }
      resolve(stdout || stderr);
    });
  }));
};
