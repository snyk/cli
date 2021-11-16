module.exports = patch;

const now = new Date();

const debug = require('debug')('snyk');
const chalk = require('chalk');
const glob = require('glob');
const tempy = require('tempy');
const fs = require('fs');
const path = require('path');
const flatten = require('lodash.flatten');
const cloneDeep = require('lodash.clonedeep');
const applyPatch = require('./apply-patch');
const stripVersions = require('./strip-versions');
const getVulnSource = require('./get-vuln-source');
const dedupe = require('./dedupe-patches');
const writePatchFlag = require('./write-patch-flag');
const { spinner } = require('../spinner');
const errors = require('../errors/legacy-errors');
const analytics = require('../analytics');
const { default: getPatchFile } = require('./fetch-patch');

function patch(vulns, live) {
  const lbl = 'Applying patches...';
  const errorList = [];

  return (
    spinner(lbl)
      .then(() => {
        // the target directory where our module name will live
        vulns.forEach((vuln) => (vuln.source = getVulnSource(vuln, live)));

        const deduped = dedupe(vulns);
        debug('patching %s vulns after dedupe', deduped.packages.length);

        // find the patches, pull them down off the web, save them in a temp file
        // then apply each individual patch - but do it one at a time (via reduce)
        const promises = deduped.packages.reduce((acc, vuln) => {
          return acc.then((res) => {
            const patches = vuln.patches; // this is also deduped in `dedupe`

            if (patches === null) {
              debug('no patch available for ' + vuln.id);
              analytics.add('no-patch', vuln.from.slice(1).join(' > '));
              return res;
            }

            analytics.add('patch', vuln.from.slice(1).join(' > '));
            debug(`Patching vuln: ${vuln.id} ${vuln.from}`);

            // the colon doesn't like Windows, ref: https://git.io/vw2iO
            const fileSafeId = vuln.id.replace(/:/g, '-');
            const flag = path.resolve(
              vuln.source,
              '.snyk-' + fileSafeId + '.flag',
            );
            const oldFlag = path.resolve(
              vuln.source,
              '.snyk-' + vuln.id + '.flag',
            );

            // get the patches on the local fs
            const promises = patches.urls.map((url) => {
              const filename = tempy.file({
                extension: '.' + fileSafeId + '.snyk-patch',
              });
              return getPatchFile(url, filename)
                .then((patch) => {
                  // check whether there's a trace of us having patched before
                  return Promise.resolve(fs.existsSync(flag))
                    .then((exists) => {
                      // if the file doesn't exist, look for the old style filename
                      // in case and for backwards compatability
                      return exists || fs.existsSync(oldFlag);
                    })
                    .then((exists) => {
                      if (!exists) {
                        return patch;
                      }
                      debug(
                        'Previous flag found = ' +
                          exists +
                          ' | Restoring file back to original to apply the patch again',
                      );
                      // else revert the patch
                      return new Promise((resolve, reject) => {
                        // find all backup files that do not belong to transitive deps
                        glob(
                          '**/*.orig',
                          { cwd: vuln.source, ignore: '**/node_modules/**' },
                          (error, files) => {
                            if (error) {
                              return reject(error);
                            }

                            // copy '.orig' backups over the patched files
                            for (const file of files) {
                              const backupFile = path.resolve(
                                vuln.source,
                                file,
                              );
                              const sourceFile = backupFile.slice(
                                0,
                                -'.orig'.length,
                              );
                              debug('restoring', backupFile, sourceFile);
                              fs.renameSync(backupFile, sourceFile);
                            }

                            resolve(patch);
                          },
                        );
                      });
                    });
                })
                .then((patch) => {
                  if (patch === false) {
                    debug('already patched %s', vuln.id);
                    return vuln;
                  }

                  debug(
                    'applying patch file for %s: \n%s\n%s',
                    vuln.id,
                    url,
                    patch,
                  );

                  return applyPatch(patch, vuln, live, url)
                    .then(
                      () => {
                        return true;
                      },
                      (e) => {
                        errorList.push(e);
                        return false;
                      },
                    )
                    .then(writePatchFlag(now, vuln))
                    .then((ok) => {
                      return ok ? vuln : false;
                    });
                });
            });

            return Promise.all(promises).then((result) => {
              res.push(result);
              return res; // this is what makes the waterfall reduce chain work
            });
          });
        }, Promise.resolve(deduped.removed));

        const promise = promises
          .then((res) => {
            const patched = flatten(res).filter(Boolean);

            if (!live) {
              debug('[skipping - dry run]');
              return patched;
            }
            return Promise.all(patched);
          })
          .then((patched) => {
            const config = {};

            // this reduce function will look to see if the patch actually resolves
            // more than one vulnerability, and if it does, it'll replicate the
            // patch rule against the *other* vuln.ids. This will happen when the user
            // runs the wizard and selects to apply a patch that fixes more than one
            // vuln.
            const mapped = patched.map(patchRule).reduce((acc, curr, i) => {
              const vuln = patched[i];
              if (vuln.grouped && vuln.grouped.includes) {
                vuln.grouped.includes.forEach((id) => {
                  const rule = cloneDeep(curr);
                  rule.vulnId = id;
                  acc.push(rule);
                });
              }

              acc.push(curr);

              return acc;
            }, []);

            config.patch = mapped.reduce((acc, curr) => {
              if (!acc[curr.vulnId]) {
                acc[curr.vulnId] = [];
              }

              const id = curr.vulnId;
              delete curr.vulnId;
              acc[id].push(curr);

              return acc;
            }, {});

            debug('patched', config);

            return config;
          });

        return promise;
      })
      // clear spinner in case of success or failure
      .then(spinner.clear(lbl))
      .catch((error) => {
        spinner.clear(lbl)();
        throw error;
      })
      .then((res) => {
        if (errorList.length) {
          errorList.forEach((error) => {
            console.log(chalk.red(errors.message(error)));
            debug(error.stack);
          });
          throw new Error(
            'Please email support@snyk.io if this problem persists.',
          );
        }

        return res;
      })
  );
}

function patchRule(vuln) {
  const rule = {
    vulnId: vuln.id,
  };
  rule[stripVersions(vuln.from.slice(1)).join(' > ')] = {
    patched: now.toJSON(),
  };
  return rule;
}
