module.exports = applyPatch;

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var exec = require('child_process').exec;
var path = require('path');
var errorAnalytics = require('../analytics').single;

function applyPatch(patch, cwd, live) {
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
        return reject(patchError(error, out, relative, patch));
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
          return reject(patchError(error, out, relative, patch));
        }

        debug('patch succeed', out);

        resolve();
      });
    });
  });
}

function patchError(error, stdout, dir, patchFile) {
  if (error && error.code === 'ENOENT') {
    error.message = 'Failed to patch: the target could not be found.';
    return error;
  }

  var id = path.basename(patchFile).split('.').splice(1, 1).pop();

  // post the raw error to help diagnose
  errorAnalytics({
    command: 'patch-fail',
    metadata: {
      vulnId: id,
      error: error,
      stdout: stdout,
    },
  });


  // this is a general "patch failed", since we already check if the
  // patch was applied via a flag, this means something else went
  // wrong, so we'll ask the user for help to diganose.
  error = new Error('"' + path.relative(process.cwd(), dir) + '" (' + id + ')');
  error.code = 'FAIL_PATCH';

  return error;
}