module.exports = applyPatch;

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var exec = require('child_process').exec;
var path = require('path');
var errorAnalytics = require('../analytics').single;

function applyPatch(patch, vuln, live) {
  var cwd = vuln.source;
  return new Promise(function (resolve, reject) {

    var cmd = 'patch -p1 --backup --verbose < ' + patch;
    var test = ' --dry-run';

    if (!cwd) {
      cwd = process.cwd();
    }

    var relative = path.relative(process.cwd(), cwd);
    debug('%s$ %s', relative, cmd + test);

    // do a dry run first, otherwise the patch can "succeed" (exit 0) if it
    // only manages to patch *some* of the chunks (and leave the file partly
    // patched).
    exec(cmd + test, {
      cwd: cwd,
      env: process.env,
    }, function (error, stdout) { // stderr is ignored
      var out = stdout.trim();
      if (error || out.indexOf('FAILED') !== -1) {
        debug('patch command failed', relative, error, out);
        return patchError(error, out, relative, vuln).catch(reject);
      }

      if (!live) {
        return resolve();
      }

      // if it was okay, and it wasn't a dry-run, then let's do it for real
      exec(cmd, {
        cwd: cwd,
        env: process.env,
      }, function (error, stdout) {
        var out = stdout.trim();
        if (error || out.indexOf('FAILED') !== -1) {
          debug('patch command failed', relative, error, out);
          return patchError(error, out, relative, vuln).catch(reject);
        }

        debug('patch succeed', out);

        resolve();
      });
    });
  });
}

function patchError(error, stdout, dir, vuln) {
  if (error && error.code === 'ENOENT') {
    error.message = 'Failed to patch: the target could not be found.';
    return Promise.reject(error);
  }

  return new Promise(function (resolve, reject) {
    var id = vuln.id;

    // sneaky trick to do two sys calls in one.
    exec('npm -v && patch -v', {
      env: process.env,
    }, function (patchVError, stdout) { // stderr is ignored
      var parts = stdout.split('\n');
      var npmVersion = parts.shift();
      var patchVersion = parts.shift();

      // post the raw error to help diagnose
      errorAnalytics({
        command: 'patch-fail',
        metadata: {
          from: vuln.from.slice(1),
          vulnId: id,
          packageName: vuln.name,
          packageVersion: vuln.version,
          package: vuln.name + '@' + vuln.version,
          error: error,
          stdout: stdout,
          'patch-version': patchVersion,
          'npm-version': npmVersion,
        },
      });

      // this is a general "patch failed", since we already check if the
      // patch was applied via a flag, this means something else went
      // wrong, so we'll ask the user for help to diganose.
      var filename = path.relative(process.cwd(), dir);
      error = new Error('"' + filename + '" (' + id + ')');
      error.code = 'FAIL_PATCH';

      reject(error);
    });
  });
}
