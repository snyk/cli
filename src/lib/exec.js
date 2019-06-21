var exec = require('child_process').exec;

module.exports = command;

function command(cmd, root) {
  return new Promise(((resolve, reject) => {
    exec(cmd, {cwd: root}, (err, stdout, stderr) => {
      var error = stderr.trim();
      if (error) {
        return reject(new Error(error + ' / ' + cmd));
      }
      resolve(stdout.split('\n').join(''));
    });
  }));
}

