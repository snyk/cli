var exec = require('child_process').exec;

module.exports = command;

function command(cmd, root) {
  return new Promise(function (resolve, reject) {
    exec(cmd, { cwd: root }, function (err, stdout, stderr) {
      var error = stderr.trim();
      if (error) {
        return reject(new Error(error + ' / ' + cmd));
      }
      resolve(stdout.split('\n').join(''));
    });
  });
}

