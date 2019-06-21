module.exports = yarn;

var debug = require('debug')('snyk');
var exec = require('child_process').exec;

function yarn(method, packages, live, cwd, flags) {
  flags = flags || [];
  if (!packages) {
    packages = [];
  }

  if (!Array.isArray(packages)) {
    packages = [packages];
  }

  method += ' ' + flags.join(' ');

  return new Promise(((resolve, reject) => {
    var cmd = 'yarn ' + method + ' ' + packages.join(' ');
    if (!cwd) {
      cwd = process.cwd();
    }
    debug('%s$ %s', cwd, cmd);

    if (!live) {
      debug('[skipping - dry run]');
      return resolve();
    }

    exec(cmd, {
      cwd: cwd,
    }, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }

      if (stderr.indexOf('ERR!') !== -1) {
        console.error(stderr.trim());
        var e = new Error('Yarn update issues: ' + stderr.trim());
        e.code = 'FAIL_UPDATE';
        return reject(e);
      }

      debug('yarn %s complete', method);

      resolve();
    });
  }));
}
