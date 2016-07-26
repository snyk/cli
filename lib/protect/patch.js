module.exports = patch;

var now = new Date();

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var chalk = require('chalk');
var recursive = require('snyk-recursive-readdir');
var request = require('request');
var tempfile = require('tempfile');
var fs = require('then-fs');
var path = require('path');
var _ = require('lodash');
var applyPatch = require('./apply-patch');
var stripVersions = require('./strip-versions');
var getVulnSource = require('./get-vuln-source');
var dedupe = require('./dedupe-patches');
var writePatchFlag = require('./write-patch-flag');
var spinner = require('../spinner');
var errors = require('../error');
var analytics = require('../analytics');

// note: cwd is optional and mostly used for testing
function patch(vulns, live, cwd) {
  var lbl = 'Applying patches...';

  // we also need to normalise the patches. specifically, using the __filename
  // as the identifier, we'll ensure the vuln.id is unique, so we don't have
  // multiple attempts to patch the same location (which leads to failed patch
  // due to "Reversed (or previously applied)").

  var noPatchRequired = {};
  if (vulns.length) {
    vulns = vulns.reduce(function (acc, curr) {
      var key = curr.id + ':' + curr.__filename;
      if (!noPatchRequired[key]) {
        noPatchRequired[key] = [];
        acc.push(curr);
      } else {
        noPatchRequired[key].push(curr);
      }
      return acc;
    }, []);
  }

  var errorList = [];
  return spinner(lbl).then(function () {
    // the target directory where our module name will live
    vulns.forEach(function (vuln) {
      vuln.source = getVulnSource(vuln, cwd, live);
    });

    var deduped = dedupe(vulns);
    debug('patching %s', deduped.packages.length);

    // find the patches, pull them down off the web, save them in a temp file
    // then apply each individual patch - but do it one at a time (via reduce)
    var promises = deduped.packages.reduce(function (acc, vuln) {
      return acc.then(function (res) {
        var patches = vuln.patches; // this is also deduped in `dedupe`

        if (patches === null) {
          debug('no patch available for ' + vuln.id);
          analytics.add('no-patch', vuln.from.slice(1).join(' > '));
          return res;
        }

        analytics.add('patch', vuln.from.slice(1).join(' > '));

        // the colon doesn't like Windows, ref: https://git.io/vw2iO
        var fileSafeId = vuln.id.replace(/:/g, '-');
        var flag = path.resolve(vuln.source, '.snyk-' + fileSafeId + '.flag');
        var oldFlag = path.resolve(vuln.source, '.snyk-' + vuln.id + '.flag');

        // get the patches on the local fs
        var promises = patches.urls.map(function (url) {
          return new Promise(function (resolve, reject) {
            var filename = tempfile('.' + fileSafeId + '.snyk-patch');
            request(url)
              .on('end', function () {
                resolve(filename);
              })
              .on('error', reject)
              .pipe(fs.createWriteStream(filename));
          }).then(function (patch) {
            // check whether there's a trace of us having patched before
            return fs.exists(flag).then(function (exists) {
              // if the file doesn't exist, look for the old style filename
              // in case and for backward compat
              return exists || fs.exists(oldFlag);
            }).then(function (exists) {
              if (!exists) {
                return patch;
              }

              // else revert the patch
              return new Promise(function (resolve, reject) {
                recursive(vuln.source, function (error, files) {
                  if (error) {
                    return reject(error);
                  }

                  resolve(Promise.all(files.filter(function (file) {
                    return file.slice(-5) === '.orig';
                  }).map(function (file) {
                    return fs.rename(file, path.dirname(file) + '/' +
                      path.basename(file).slice(0, -5));
                  })));
                });
              }).then(function () {
                return patch;
              });
            });
          }).then(function (patch) {
            if (patch === false) {
              debug('already patched %s', vuln.id);
              return vuln;
            }

            debug('applying patch file for %s: \n%s\n%s', vuln.id, url, patch);

            return applyPatch(patch, vuln, live).then(function () {
              return true;
            }, function (e) {
              errorList.push(e);
              return false;
            }).then(function (ok) {
              return ok ? vuln : false;
            });
          });
        });

        return Promise.all(promises).then(function (result) {
          res.push(result);
          return res; // this is what makes the waterfall reduce chain work
        });
      });
    }, Promise.resolve(deduped.removed));

    var promise = promises.then(function (res) {
      var patched = _.flatten(res).filter(Boolean);

      if (!live) {
        debug('[skipping - dry run]');
        return patched;
      }

      return Promise.all(patched.map(writePatchFlag.bind(null, now)));
    }).then(function (patched) {
      patched = patched.reduce(function (acc, curr) {
        var key = curr.id + ':' + curr.__filename;

        if (noPatchRequired[key]) {
          noPatchRequired[key].forEach(function (vuln) {
            acc.push(vuln);
          });
        }

        acc.push(curr);

        return acc;
      }, []);

      var config = {};

      // this reduce function will look to see if the patch actually resolves
      // more than one vulnerability, and if it does, it'll replicate the
      // patch rule against the *other* vuln.ids. This will happen when the user
      // runs the wizard and selects to apply a patch that fixes more than one
      // vuln.
      var mapped = patched.map(patchRule).reduce(function (acc, curr, i) {
        var vuln = patched[i];
        if (vuln.grouped && vuln.grouped.includes) {
          vuln.grouped.includes.forEach(function (id) {
            var rule = _.cloneDeep(curr);
            rule.vulnId = id;
            acc.push(rule);
          });
        }

        acc.push(curr);

        return acc;
      }, []);

      config.patch = mapped.reduce(function (acc, curr) {
        if (!acc[curr.vulnId]) {
          acc[curr.vulnId] = [];
        }

        var id = curr.vulnId;
        delete curr.vulnId;
        acc[id].push(curr);

        return acc;
      }, {});

      debug('patched', config);

      return config;
    });

    return promise;
  }).then(spinner.clear(lbl)).then(function (res) {
    if (errorList.length) {
      errorList.forEach(function (error) {
        console.log(chalk.red(errors.message(error)));
      });
    }

    return res;
  });
}

function patchRule(vuln) {
  var rule = {
    vulnId: vuln.id,
  };
  rule[stripVersions(vuln.from.slice(1)).join(' > ')] = {
    patched: now.toJSON(),
  };
  return rule;
}
