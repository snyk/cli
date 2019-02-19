module.exports = applyPatch;

var debug = require('debug')('snyk');
var diff = require('diff');
var exec = require('child_process').exec;
var path = require('path');
var fs = require('fs');
var uuid = require('uuid/v4');
var errorAnalytics = require('../analytics').single;

function applyPatch(patch, vuln, live, patchUrl) {
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
      patchError(error, relative, vuln, patchUrl).catch(reject);
    });
  });
}

function jsDiff(patchContent, relative, live) {
  var patchedFiles = {};
  return new Promise(function (resolve, reject) {
    diff.applyPatches(patchContent, {
      loadFile: function (index, callback) {
        try {
          var fileName = trimUpToFirstSlash(index.oldFileName);
          if (patchedFiles[fileName]) {
            return callback(null, patchedFiles[fileName]);
          }
          var content = fs.readFileSync(path.resolve(relative, fileName), 'utf8');
          callback(null, content);
        } catch (err) {
          // collect patch metadata for error analysis
          err.patchIssue = JSON.stringify(index);
          callback(err);
        }
      },
      patched: function (index, content, callback) {
        try {
          if (content === false) {
            // `false` means the patch does not match the original content.
            var error = new Error('Found a mismatching patch');
            error.patchIssue = JSON.stringify(index);
            throw error;
          }
          var newFileName = trimUpToFirstSlash(index.newFileName);
          var oldFileName = trimUpToFirstSlash(index.oldFileName);
          if (newFileName !== oldFileName) {
            patchedFiles[oldFileName] = null;
          }
          patchedFiles[newFileName] = content;
          callback();
        } catch (err) {
          callback(err);
        }
      },
      compareLine: function (_, line, operation, patchContent) {
        if (operation === ' ') {
          // Ignore when no patch operators as GNU patch does
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
          // write patched files back to disk, unlink files completely removed by patching
          for (var fileName of patchedFiles) {
            if (typeof patchedFiles[fileName] === 'string') {
              fs.writeFileSync(path.resolve(relative, fileName), patchedFiles[fileName]);
            } else {
              fs.unlinkSync(path.resolve(relative, fileName));
            }
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      },
    });
  });
}

// diff data compares the same file with a dummy path (a/path/to/real.file vs b/path/to/real.file)
// skipping the dummy folder name by trimming up to the first slash
function trimUpToFirstSlash(fileName) {
  return fileName && fileName.replace(/^[^\/]+\//, '');
}

function patchError(error, dir, vuln, patchUrl) {
  if (error && error.code === 'ENOENT') {
    error.message = 'Failed to patch: the target could not be found.';
    return Promise.reject(error);
  }

  return new Promise(function (resolve, reject) {
    var id = vuln.id;

    exec('npm -v', {
      env: process.env,
    }, function (npmVError, versions) { // stderr is ignored
      var npmVersion = versions && versions.split('\n').shift();
      var referenceId = uuid();

      // this is a general "patch failed", since we already check if the
      // patch was applied via a flag, this means something else went
      // wrong, so we'll ask the user for help to diagnose.
      var filename = path.relative(process.cwd(), dir);

      // post metadata to help diagnose
      errorAnalytics({
        command: 'patch-fail',
        metadata: {
          from: vuln.from.slice(1),
          vulnId: id,
          packageName: vuln.name,
          packageVersion: vuln.version,
          package: vuln.name + '@' + vuln.version,
          patchError: Object.assign({}, {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }, error),
          'npm-version': npmVersion,
          referenceId: referenceId,
          patchUrl: patchUrl,
          filename: filename,
        },
      });

      var msg = id + ' on ' + vuln.name + '@' + vuln.version + ' at "' + filename + '"\n' +
                error + ', ' + 'reference ID: ' + referenceId + '\n';

      error = new Error(msg);
      error.code = 'FAIL_PATCH';

      reject(error);
    });
  });
}
