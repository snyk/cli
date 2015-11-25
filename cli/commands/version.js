var path = require('path');
var exec = require('child_process').exec;
var Promise = require('es6-promise').Promise; // jshint ignore:line
var root = path.resolve(__dirname, '..', '..');

module.exports = function () {
  return new Promise(function (resolve) {
    var filename = path.resolve(__dirname, '..', '..', 'package.json');
    var version = require(filename).version;

    if (version && version !== '0.0.0') {
      return resolve(version);
    }

    // else we're in development, give the commit out
    // get the last commit and whether the working dir is dirty
    var promises = [
      branch(),
      commit(),
      dirty(),
    ];

    resolve(Promise.all(promises).then(function (res) {
      var branch = res[0];
      var commit = res[1];
      var dirtyCount = parseInt(res[2], 10);
      var curr = branch + ': ' + commit;
      if (dirtyCount !== 0) {
        curr += ' (' + dirtyCount + ' dirty files)';
      }

      return curr;
    }));
  });
};

function command(cmd) {
  return new Promise(function (resolve, reject) {
    exec(cmd, { cwd: root }, function (err, stdout, stderr) {
      var error = stderr.trim();
      if (error) {
        return reject(new Error(error));
      }
      resolve(stdout.split('\n').join(''));
    });
  });
}

function commit() {
  return command('git rev-parse HEAD');
}

function branch() {
  return command('git rev-parse --abbrev-ref HEAD');
}

function dirty() {
  return command('expr $(git status --porcelain 2>/dev/null| ' +
      'egrep "^(M| M)" | wc -l)');
}