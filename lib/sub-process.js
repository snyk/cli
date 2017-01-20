var Promise = require('es6-promise').Promise;
var childProcess = require('child_process');

module.exports.execute = function (command, args, options) {
  var spawnOptions = { shell: true };
  if (options && options.cwd) {
    spawnOptions.cwd = options.cwd;
  }

  return new Promise(function (resolve, reject) {
    var stdout = '';
    var stderr = '';

    var proc = childProcess.spawn(command, args, spawnOptions);
    proc.stdout.on('data', function (data) { stdout = stdout + data; });
    proc.stderr.on('data', function (data) { stderr = stderr + data; });

    proc.on('close', function (code) {
      if (code !== 0) {
        return reject(stdout || stderr);
      }
      resolve({ stdout: stdout, stderr: stderr });
    });
  });
};
