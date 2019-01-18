module.exports = applyPatch;

var debug = require('debug')('snyk');
var diff = require('diff');
var exec = require('child_process').exec;
var path = require('path');
var fs = require('fs');
var errorAnalytics = require('../analytics').single;

function applyPatch(patch, vuln, live) {
  var cwd = vuln.source;

  return new Promise(function (resolve, reject) {
    if (!cwd) {
      cwd = process.cwd();
    }

    var relative = path.relative(process.cwd(), cwd);
    debug('DRY RUN: relative: %s cmd + test: %s', relative, cmd + test);

    try {
      var packageJson = fs.readFileSync(path.resolve(relative, 'package.json'));
      var pkg = JSON.parse(packageJson);
      debug('package at patch target location: %s@%s', pkg.name, pkg.version);
    } catch (err) {
      debug('Failed loading package.json of package about to be patched', err);
    }

    diff.applyPatches(patch, {
      loadFile: function (index, callback) {
        try {
          var content = fs.readFileSync(path.resolve(relative, index.oldFileName), 'utf8');
          callback(null, content);
        } catch (err) {
          callback(err);
        }
      },
      patched: function (index, content, callback) {
        if (live) {
          try {
            fs.writeFileSync(index.newFileName, content);
            callback();
          } catch (err) {
            callback(err);
          }
        }
      },
      complete: function (error) {
        if (error) {
          debug('patch command failed', relative, error, out);
          return patchError(error, relative, vuln).catch(reject);
        }

        debug('patch succeed');

        resolve();
      }
    });
  });
}

function patchError(error, dir, vuln) {
  if (error && error.code === 'ENOENT') {
    error.message = 'Failed to patch: the target could not be found.';
    return Promise.reject(error);
  }

  return new Promise(function (resolve, reject) {
    var id = vuln.id;

    exec('npm -v', {
      env: process.env,
    }, function (patchVError, versions) { // stderr is ignored
      var parts = versions.split('\n');
      var npmVersion = parts.shift();

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
