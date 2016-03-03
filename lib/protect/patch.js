module.exports = patch;

var now = new Date();

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var chalk = require('chalk');
var recursive = require('recursive-readdir');
var request = require('request');
var tempfile = require('tempfile');
var fs = require('then-fs');
var path = require('path');
var _ = require('lodash');
var patchesForPackage = require('./patches-for-package');
var applyPatch = require('./apply-patch');
var stripVersions = require('./strip-versions');
var getVulnSource = require('./get-vuln-source');
var spinner = require('../spinner');
var errors = require('../error');

// note: cwd is optional and mostly used for testing
function patch(packages, live, cwd) {
  var lbl = 'Applying patches...';
  var error = null;
  return spinner(lbl).then(function () {
    debug('patching %s', packages.length);

    // find the patches, pull them down off the web, save them in a temp file
    // then apply each individual patch - but do it one at a time (via reduce)
    var promises = packages.reduce(function (acc, vuln) {
      return acc.then(function (res) {
        var patches = patchesForPackage(vuln);

        if (patches === null) {
          debug('no patch available for ' + vuln.id);
          return false;
        }

        // the target directory where our module name will live
        var source = getVulnSource(vuln, cwd, live);

        var flag = path.resolve(source, '.snyk-' + vuln.id + '.flag');

        // get the patches on the local fs
        var promises = patches.urls.map(function (url) {
          return new Promise(function (resolve, reject) {
            var filename = tempfile('.' + vuln.id + '.snyk-patch');
            request(url)
              .on('end', function () {
                resolve(filename);
              })
              .on('error', reject)
              .pipe(fs.createWriteStream(filename));
          }).then(function (patch) {
            // check whether there's a trace of us having patched before
            return fs.exists(flag).then(function (exists) {
              if (!exists) {
                return patch;
              }

              // else revert the patch
              return new Promise(function (resolve, reject) {
                recursive(source, function (error, files) {
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

            return applyPatch(patch, source, live).then(function () {
              if (!live) {
                debug('[skipping - dry run]');
                return true;
              }

              debug('writing flag for %s', vuln.id);
              var promise;
              if (vuln.grouped && vuln.grouped.includes) {
                debug('found addition vulns to write flag files for');
                var writePromises = [fs.writeFile(flag, now.toJSON(), 'utf8')];
                debug(flag);
                vuln.grouped.includes.forEach(function (id) {
                  var flag = path.resolve(source, '.snyk-' + id + '.flag');
                  debug(flag);
                  writePromises.push(fs.writeFile(flag, now.toJSON(), 'utf8'));
                });
                promise = Promise.all(writePromises);
              } else {
                promise = fs.writeFile(flag, now.toJSON(), 'utf8');
              }

              return promise.then(function () {
                return true;
              });
            }, function (e) {
              error = e;
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
    }, Promise.resolve([]));

    var promise = promises.then(function (res) {
      var patched = _.flatten(res).filter(Boolean);

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
    if (error) {
      console.log(chalk.red(errors.message(error)));
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
