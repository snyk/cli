var protect = module.exports = {
  ignore: ignore,
  update: update,
  patch: patch,
  patchesForPackage: patchesForPackage,
  filterIgnored: filterIgnored,
  generatePolicy: generatePolicy,
  filterPatched: filterPatched,
  attachNotes: attachNotes,
  applyPatch: applyPatch,
};

var now = new Date();

var debug = require('debug')('snyk');
var recursive = require('recursive-readdir');
var chalk = require('chalk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var moduleToObject = require('snyk-module');
var request = require('request');
var tempfile = require('tempfile');
var semver = require('semver');
var fs = require('then-fs');
var statSync = require('fs').statSync;
var resolve = require('snyk-resolve');
var path = require('path');
var _ = require('lodash');
var exec = require('child_process').exec;
var errors = require('./error');
var errorAnalytics = require('./analytics').single;
var npm = require('./npm');
var snyk = require('./');
var username = require('./user-config').get('username') || process.env.USER;
var spinner = require('./spinner');
var oneDay = 1000 * 60 * 60 * 24;

// FIXME remove!!!
function id(vuln) {
  debug('FIXME generating vuln.id for %s', vuln.name);
  var rnd = parseInt((Math.random() + '').split('.').pop(), 10)
            .toString(16).slice(0, 6);
  return 'node-' + vuln.name + '-' + rnd;
}

function ignore(data) {
  return new Promise(function (resolve) {
    var config = {};
    config.ignore = data.map(function (res) {
      var vuln = res.vuln;
      var days = res.meta.days || 30;
      var ignoreRule = {};
      ignoreRule[stripVersions(vuln.from.slice(1)).join(' > ')] = {
        reason: res.meta.reason,
        expires: new Date(Date.now() + (oneDay * days)).toJSON(),
      };
      ignoreRule.vulnId = vuln.id || id(vuln);
      return ignoreRule;
    }).reduce(function (acc, curr) {
      if (!acc[curr.vulnId]) {
        acc[curr.vulnId] = [];
      }

      var id = curr.vulnId;
      delete curr.vulnId;
      acc[id].push(curr);

      return acc;
    }, {});

    // final format looks like test/fixtures/protect-interactive-config.json
    debug('ignore config', config);

    resolve(config);
  });
}

function update(packages, live) {
  var lbl = 'Running `npm update`...';
  var error = false;
  return spinner(lbl).then(function () {
    // the uninstall doesn't need versions in the strings
    // but install *does* so we build up arrays of both
    var upgradeWithoutVersions = [];
    var upgrade = packages.map(function (vuln) {
      // FIXME the line below is wrong, should be .filter(Boolean)[0]
      var remediation = vuln.upgradePath.filter(Boolean)[0];
      upgradeWithoutVersions.push(remediation.split('@').shift());
      return remediation;
    });

    debug('to upgrade', upgrade);

    if (upgrade.length === 0) {
      return;
    }

    var toUninstall = _.unique(upgradeWithoutVersions);
    var promise = npm('uninstall', toUninstall, live).then(function () {
      return npm('install', findUpgrades(upgrade), live).catch(function (e) {
        error = e;
        return false;
      });
    });

    return promise;
  }).then(spinner.clear(lbl)).then(function (res) {
    if (error) {
      console.error(chalk.red(errors.message(error)));
    }

    return res;
  });
}

function findUpgrades(packages) {
  return packages.map(moduleToObject).reduce(function (acc, curr) {
    var have = acc.filter(function (pkg) {
      return pkg.name === curr.name;
    }).pop();

    if (have) {
      if (semver.gt(curr.version, have.version)) {
        have.version = curr.version;
      }
    } else {
      acc.push(curr);
    }

    return acc;
  }, []).map(function (pkg) {
    return pkg.name + '@' + pkg.version;
  });
}

// given an ignore ruleset (parsed from the .snyk yaml file) and a array of
// vulnerabilities, return the vulnerabilities that *are not* ignored
// see http://git.io/vCHmV for example of what ignore structure looks like
function filterIgnored(ignore, vuln) {
  if (!ignore) {
    return vuln;
  }
  debug('filtering ignored');
  var now = Date.now();

  return vuln.map(function (vuln) {
    if (!ignore[vuln.id]) {
      return vuln;
    }

    // this is a cursory test to ensure that we're working with a snyk format
    // that we recognise. if the property is an object, then it's the early
    // alpha format, and we'll throw
    if (!Array.isArray(ignore[vuln.id])) {
      var error = new Error('old, unsupported .snyk format detected');
      error.code = 'OLD_DOTFILE_FORMAT';
      throw error;
    }

    debug('%s has rules', vuln.id);

    // logic: loop through all rules (from `ignore[vuln.id]`), and if *any* dep
    // paths match our vuln.from dep chain AND the rule hasn't expired, then the
    // vulnerability is ignored. if none of the rules match, then let we'll
    // keep it.

    // if rules.some, then ignore vuln
    var res = ignore[vuln.id].some(function (rule) {
      var path = Object.keys(rule)[0]; // this is a string
      var expires = rule[path].expires;

      // first check if the path is a match on the rule
      var pathMatch = snyk.policy.matchToRule(vuln, rule);

      if (pathMatch && expires < now) {
        debug('%s vuln rule has expired (%s)', vuln.id, expires);
        return false;
      }

      if (pathMatch) {
        debug('ignoring based on path match: %s ~= %s', path,
          vuln.from.slice(1).join(' > '));
        return true;
      }

      return false;
    });

    return res ? false : vuln;
  }).filter(Boolean);
}


function attachNotes(notes, vuln) {
  if (!notes) {
    return vuln;
  }
  debug('attaching notes');
  var now = Date.now();

  return vuln.map(function (vuln) {
    if (!notes[vuln.id]) {
      return vuln;
    }

    debug('%s has rules', vuln.id);

    // if rules.some, then add note to the vuln
    notes[vuln.id].forEach(function (rule) {
      var path = Object.keys(rule)[0]; // this is a string
      var expires = rule[path].expires;

      // first check if the path is a match on the rule
      var pathMatch = snyk.policy.matchToRule(vuln, rule);

      if (pathMatch && expires < now) {
        debug('%s vuln rule has expired (%s)', vuln.id, expires);
        return false;
      }

      if (pathMatch) {
        // strip any control characters in the 3rd party reason file
        var reason = rule[path].reason.replace('/[\x00-\x1F\x7F-\x9F]/u', '');
        debug('adding note based on path match: %s ~= %s', path,
          vuln.from.slice(1).join(' > '));
        vuln.note = 'Snyk policy in ' + rule[path].from +
          ' suggests ignoring this issue, with reason: ' + reason;
      }

      return false;
    });

    return vuln;
  });
}



// cwd is used for testing
function filterPatched(patched, vuln, cwd) {
  if (!patched) {
    return vuln;
  }
  debug('filtering patched');
  return vuln.map(function (vuln) {
    if (!patched[vuln.id]) {
      return vuln;
    }

    debug('%s has rules', vuln.id);

    // logic: loop through all rules (from `patched[vuln.id]`), and if *any* dep
    // paths match our vuln.from dep chain AND a flag exists, then the
    // vulnerability is ignored. if none of the rules match, then let we'll
    // keep it.

    // if rules.some, then ignore vuln
    var filtered = patched[vuln.id].map(function (rule) {

      // first check if the path is a match on the rule
      var pathMatch = snyk.policy.matchToRule(vuln, rule);

      if (pathMatch) {
        var path = Object.keys(rule)[0]; // this is a string
        debug('(patch) ignoring based on path match: %s ~= %s', path,
          vuln.from.slice(1).join(' > '));
        return vuln;
      }

      return false;
    }).filter(Boolean);

    // run through the potential rules to check if there's a patch flag in place
    var res = filtered.some(function (vuln) {
      // the target directory where our module name will live
      var source = getVulnSource(vuln, cwd, true);

      var flag = path.resolve(source, '.snyk-' + vuln.id + '.flag');
      var res = false;
      try {
        res = statSync(flag);
      } catch (e) {}

      debug('flag found for %s? %s', vuln.id);

      return !!res;
    });

    return res ? false : vuln;
  }).filter(Boolean);
}

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
        var patches = patchesForPackage(vuln, vuln);

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

function getVulnSource(vuln, cwd, live) {
  var from = vuln.from.slice(1).map(function (pkg) {
    return moduleToObject(pkg).name;
  });

  var viaPath = path.resolve(
    cwd || process.cwd(),
    'node_modules',
    from.join('/node_modules/')
  );

  var source = vuln.__filename ?
      path.dirname(vuln.__filename) :
      viaPath;

  // try to stat the directory, if it throws, it doesn't exist...
  try {
    statSync(source);
  } catch (e) {
    // ...which means the package is located in a parent path (from an
    // npm dedupe process), so we remove the module name from the path
    // and use the `resolve` package to navigate the node_modules up
    // through parent directories.
    try {
      source = resolve.sync(from.slice(-1).pop(), viaPath);
    } catch (e) {
      if (live) {
        throw e;
      }

      // otherwise this is a dry run so we don't mind that it won't be
      // able to patch - likely a scenario run, so it's fine that the
      // patch target won't be found
    }
    debug('found better source for package: %s', source);
  }


  return source;
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

function generatePolicy(policy, tasks, live) {
  var promises = [
    protect.ignore(tasks.ignore, live),
    protect.update(tasks.update, live),
    protect.patch(tasks.patch, live),
    log(tasks, live),
  ];

  return Promise.all(promises).then(function (res) {
    // we're squashing the arrays of arrays into a flat structure
    // with only non-false values
    var results = _.flattenDeep(res).filter(Boolean);

    // then we merge the configs together using the original config
    // as the baseline (this lets us retain the user's existing config)
    results.unshift(policy);
    var newPolicy = _.merge.apply(_, results);

    debug(JSON.stringify(newPolicy, '', 2));

    return newPolicy;
  });
}

function patchesForPackage(pkg, vuln) {
  return vuln.patches.filter(function (patch) {
    if (semver.satisfies(vuln.version, patch.version)) {
      return (patch.urls || []).length ? patch : false;
    }
    return false;
  })[0] || null;
}

function stripVersions(packages) {
  return packages.map(function (pkg) {
    return moduleToObject(pkg).name;
  });
}

function log(tasks) {
  return new Promise(function (resolve) {
    var config = { log: {} };
    var log = config.log[new Date().toJSON() + ' by ' + username] = {};

    ['ignore', 'patch', 'update'].forEach(function (task) {
      if (tasks[task].length && log[task] === undefined) {
        log[task] = [];
      }

      tasks[task].forEach(function (res) {
        var message = logformat[task](res);
        log[task].push(message);
      });
    });

    // TODO post log to server
    debug('log --------------');
    debug(config);

    resolve(false); // resolve, but with a value that will be removed.
  });
}

var logformat = {
  ignore: function (res) {
    return res.vuln.id + ' on ' + res.vuln.from.join(' > ') + ': ' +
      res.meta.reason;
  },
  update: function (vuln) {
    var remediation = vuln.upgradePath.filter(Boolean);
    var source = vuln.from[vuln.from.length - remediation.length];
    return vuln.id + ' on ' + vuln.from.join(' > ') + ': updated ' +
      source + ' to ' + remediation[0];
  },
  patch: function (vuln) {
    return vuln.id + ' on ' + vuln.from.join(' > ');
  },
};