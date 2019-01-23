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
    debug('DRY RUN: relative: %s', relative);

    try {
      var packageJson = fs.readFileSync(path.resolve(relative, 'package.json'));
      var pkg = JSON.parse(packageJson);
      debug('package at patch target location: %s@%s', pkg.name, pkg.version);
    } catch (err) {
      debug('Failed loading package.json of package about to be patched', err);
    }

    var patchContent = fs.readFileSync(path.resolve(relative, patch), 'utf8');

    jsDiff(patchContent, relative, live).then(function () {
      debug('patch succeed');
      resolve();
    }).catch(function (error) {
      debug('patch command failed', relative, error);
      patchError(error, relative, vuln).catch(reject);
    });
  });
}

function jsDiff(patchContent, relative, live) {
  const files = {};
  return new Promise(function (resolve, reject) {
    diff.applyPatches(patchContent, {
      loadFile: function (index, callback) {
        try {
          var fileName = stripFirstSlash(index.oldFileName);
          if (files[fileName]) {
            return callback(null, files[fileName]);
          }
          var content = fs.readFileSync(path.resolve(relative, fileName), 'utf8');
          callback(null, content);
        } catch (err) {
          callback(err);
        }
      },
      patched: function (index, content, callback) {
        try {
          if (content === false) {
            throw new Error('Found a mismatching patch\n' + JSON.stringify(index, null, 2));
          }
          var newFileName = stripFirstSlash(index.newFileName);
          var oldFileName = stripFirstSlash(index.oldFileName);
          if (newFileName !== oldFileName) {
            files[oldFileName] = null;
          }
          files[newFileName] = content;
          callback();
        } catch (err) {
          callback(err);
        }
      },
      compareLine: function (_, line, operation, patchContent) {
        if (operation === ' ') {
          return true;
        }
        return line === patchContent;
      },
      complete: function (error) {
        if (error) {
          return reject(error);
        }
        if (!live) {
          return resolve();
        }
        try {
          for (var fileName of files) {
            if (files[fileName] === null) {
              fs.unlinkSync(path.resolve(relative, fileName));
            }
            fs.writeFileSync(path.resolve(relative, fileName), files[fileName]);
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      },
    });
  });
}

function stripFirstSlash(fileName) {
  return fileName.replace(/^[^\/]+\//, '');
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
      // wrong, so we'll ask the user for help to diagnose.
      var filename = path.relative(process.cwd(), dir);
      error = new Error('"' + filename + '" (' + id + ')');
      error.code = 'FAIL_PATCH';

      reject(error);
    });
  });
}
