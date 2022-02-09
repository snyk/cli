const { v4: uuidv4 } = require('uuid');
const debug = require('debug')('snyk');
const diff = require('diff');
const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');
const semver = require('semver');
const { addDataAndSend } = require('../analytics');

function applyPatch(patchFileName, vuln, live, patchUrl) {
  let cwd = vuln.source;

  return new Promise((resolve, reject) => {
    if (!cwd) {
      cwd = process.cwd();
    }

    const relative = path.relative(process.cwd(), cwd);
    debug('DRY RUN: relative: %s', relative);

    try {
      let pkg = {};
      const packageJsonPath = path.resolve(relative, 'package.json');
      try {
        const packageJson = fs.readFileSync(packageJsonPath);
        pkg = JSON.parse(packageJson);
        debug('package at patch target location: %s@%s', pkg.name, pkg.version);
      } catch (err) {
        debug(
          'Failed loading package.json at %s. Skipping patch!',
          packageJsonPath,
          err,
        );
        return resolve();
      }

      const versionOfPackageToPatch = pkg.version;
      const patchableVersionsRange = vuln.patches.version;

      const isSemverMatch = semver.satisfies(
        versionOfPackageToPatch,
        patchableVersionsRange,
      );

      const isVersionMatch = semver.satisfies(
        versionOfPackageToPatch,
        semver.valid(semver.coerce(vuln.patches.version)),
      );

      if (isSemverMatch || isVersionMatch) {
        debug(
          'Patch version range %s matches package version %s',
          patchableVersionsRange,
          versionOfPackageToPatch,
        );
      } else {
        debug(
          'Patch version range %s does not match package version %s. Skipping patch!',
          patchableVersionsRange,
          versionOfPackageToPatch,
        );
        return resolve();
      }

      const patchContent = fs.readFileSync(
        path.resolve(relative, patchFileName),
        'utf8',
      );

      jsDiff(patchContent, relative, live).then(() => {
        debug('patch succeed');
        resolve();
      });
    } catch (error) {
      debug('patch command failed', relative, error);
      patchError(error, relative, vuln, patchUrl).catch(reject);
    }
  });
}

function jsDiff(patchContent, relative, live) {
  const patchedFiles = {};
  return new Promise((resolve, reject) => {
    diff.applyPatches(patchContent, {
      loadFile: function (index, callback) {
        try {
          const fileName = trimUpToFirstSlash(index.oldFileName);
          if (patchedFiles[fileName]) {
            return callback(null, patchedFiles[fileName]);
          }

          const filePath = path.resolve(relative, fileName);
          const content = fs.readFileSync(filePath, 'utf8');

          // create an `.orig` copy of the file prior to patching it
          // used in case we need to revert a patch
          const origFilePath = filePath + '.orig';
          fs.writeFileSync(origFilePath, content);

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
            const error = new Error('Found a mismatching patch');
            error.patchIssue = JSON.stringify(index);
            throw error;
          }
          const newFileName = trimUpToFirstSlash(index.newFileName);
          const oldFileName = trimUpToFirstSlash(index.oldFileName);
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
          for (const fileName in patchedFiles) {
            if (typeof patchedFiles[fileName] === 'string') {
              fs.writeFileSync(
                path.resolve(relative, fileName),
                patchedFiles[fileName],
              );
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
  return fileName && fileName.replace(/^[^/]+\//, '');
}

function patchError(error, dir, vuln, patchUrl) {
  if (error && error.code === 'ENOENT') {
    error.message =
      'Failed to patch: the target could not be found (' + error.message + ').';
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const id = vuln.id;

    exec(
      'npm -v',
      {
        env: process.env,
      },
      (npmVError, versions) => {
        // stderr is ignored
        const npmVersion = versions && versions.split('\n').shift();
        const referenceId = uuidv4();

        // this is a general "patch failed", since we already check if the
        // patch was applied via a flag, this means something else went
        // wrong, so we'll ask the user for help to diagnose.
        const filename = path.relative(process.cwd(), dir);

        // post metadata to help diagnose
        addDataAndSend({
          command: 'patch-fail',
          metadata: {
            from: vuln.from.slice(1),
            vulnId: id,
            packageName: vuln.name,
            packageVersion: vuln.version,
            package: vuln.name + '@' + vuln.version,
            patchError: Object.assign(
              {},
              {
                message: error.message,
                stack: error.stack,
                name: error.name,
              },
              error,
            ),
            'npm-version': npmVersion,
            referenceId: referenceId,
            patchUrl: patchUrl,
            filename: filename,
          },
        });

        const msg =
          id +
          ' on ' +
          vuln.name +
          '@' +
          vuln.version +
          ' at "' +
          filename +
          '"\n' +
          error +
          ', ' +
          'reference ID: ' +
          referenceId +
          '\n';

        error = new Error(msg);
        error.code = 'FAIL_PATCH';

        reject(error);
      },
    );
  });
}

module.exports = applyPatch;
