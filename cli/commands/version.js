var path = require('path');
var exec = require('child_process').exec;
var Promise = require('es6-promise').Promise; // jshint ignore:line

module.exports = function () {
  return new Promise(function (resolve) {
    var filename = path.resolve(__dirname, '..', '..', 'package.json');
    var version = require(filename).version;

    if (version && version !== '0.0.0') {
      return resolve(version);
    }

    // else we're in development, give the commit out
    var root = path.resolve(__dirname, '..', '..');
    // get the last commit and whether the working dir is dirty
    var cmd = 'expr $(git status --porcelain 2>/dev/null| ' +
      'egrep "^(M| M)" | wc -l)';

    exec(cmd, {
      cwd: root,
    }, function (error, stdout) {
      var dirtyCount = parseInt(stdout.trim(), 10);

      var git = require('git-rev'); // only included in devDeps

      return git.branch(function (branch) {
        git.long(function (hash) {
          var curr = branch + ': ' + hash;
          if (dirtyCount !== 0) {
            curr += ' (' + dirtyCount + ' dirty files)';
          }
          resolve(curr);
        });
      });
    });
  });
};