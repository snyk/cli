var protect = module.exports = {
  ignore: ignore,
  update: update,
  patch: patch,
  patchesForPackage: patchesForPackage,
  filterIgnored: filterIgnored,
  generatePolicy: generatePolicy,
  filterPatched: filterPatched,
};

var debug = require('debug')('snyk');
var debugProtect = require('debug')('snyk:protect');
var chalk = require('chalk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var moduleToObject = require('snyk-module');
var request = require('request');
var tempfile = require('tempfile');
var semver = require('semver');
var fs = require('then-fs');
var statSync = require('fs').statSync;
var path = require('path');
var _ = require('lodash');
var exec = require('child_process').exec;
var errors = require('./error');
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
      ignoreRule[vuln.from.slice(1).join(' > ')] = {
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
  return spinner(lbl).then(function () {
    // the uninstall doesn't need versions in the strings
    // but install *does* so we build up arrays of both
    var upgradeWithoutVersions = [];
    var upgrade = packages.map(function (vuln) {
      // FIXME the line below is wrong, should be .filter(Boolean)[0]
      var remediation = vuln.upgradePath.slice(1).shift();
      upgradeWithoutVersions.push(remediation.split('@').shift());
      return remediation;
    });

    debug('to upgrade', upgrade);

    if (upgrade.length === 0) {
      return;
    }

    var toUninstall = _.unique(upgradeWithoutVersions);
    var promise = npm('uninstall', toUninstall, live).then(function () {
      return npm('install', findUpgrades(upgrade), live);
    });

    return promise;
  }).then(spinner.clear(lbl));
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

function npm(method, packages, live, cwd) {
  if (!Array.isArray(packages)) {
    packages = [packages];
  }
  return new Promise(function (resolve, reject) {
    var cmd = 'npm --save ' + method + ' ' + packages.join(' ');
    if (!cwd) {
      cwd = process.cwd();
    }
    debug('%s$ %s', cwd, cmd);

    if (!live) {
      debug('[skipping - dry run]');
      return resolve();
    }

    exec(cmd, {
      cwd: cwd,
    }, function (error, stdout, stderr) {
      if (error) {
        return reject(error);
      }

      if (stderr) {
        return reject(new Error(stderr.trim()));
      }

      debug('npm %s complete', method);

      resolve();
    });
  });
}

// given an ignore ruleset (parsed from the .snyk yaml file) and a array of
// vulnerabilities, return the vulnerabilities that *are not* ignored
// see http://git.io/vCHmV for example of what ignore structure looks like
function filterIgnored(ignore, vuln) {
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
      var rules = {
        path: path,
        expires: rule[path].expires,
      };

      // first check if the path is a match on the rule
      var pathMatch = false;

      // check for an exact match
      var from = vuln.from.slice(1);
      if (path.indexOf(from.join(' > ')) !== -1) {
        debug('%s exact match from %s', vuln.id, from);
        pathMatch = true;
      } else if (matchPath(from, path)) {
        pathMatch = true;
      }

      if (pathMatch && rules.expires < now) {
        debug('%s vuln rule has expired (%s)', vuln.id, rules.expires);
        return false;
      }

      if (pathMatch) {
        debug('ignoring based on path match: %s ~= %s', path, from.join(' > '));
        return true;
      }

      return false;
    });

    return res ? false : vuln;
  }).filter(Boolean);
}

// cwd is used for testing
function filterPatched(patched, vuln, cwd) {
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
      var path = Object.keys(rule)[0]; // this is a string

      // first check if the path is a match on the rule
      var pathMatch = false;


      // check for an exact match
      var from = vuln.from.slice(1);
      debug(from, rule);
      if (path.indexOf(from.join(' > ')) !== -1) {
        debug('%s exact match from %s', vuln.id, from);
        pathMatch = vuln;
      } else if (matchPath(from, path)) {
        pathMatch = vuln;
      }

      if (pathMatch) {
        debug('ignoring based on path match: %s ~= %s', path, from.join(' > '));
        return pathMatch;
      }

      return false;
    }).filter(Boolean);

    // run through the potential rules to check if there's a patch flag in place
    var res = filtered.some(function (vuln) {
      var from = vuln.from.slice(1).map(function (pkg) {
        return moduleToObject(pkg).name;
      });

      // the target directory where our module name will live
      var source = path.resolve(
        cwd || process.cwd(),
        'node_modules',
        from.join('/node_modules/')
      );

      var flag = path.resolve(source, '.snyk-' + vuln.id + '.flag');
      var res = false;
      try {
        res = statSync(flag);
      } catch (e) {}

      return !!res;
    });

    return res ? false : vuln;
  }).filter(Boolean);
}

// matchPath will take the array of dependencies that a vulnerability came from
// and try to match it to a string `path`. The path will look like this:
// express-hbs@0.8.4 > handlebars@3.0.3 > uglify-js@2.3.6
// note that the root package is never part of the path (i.e. jsbin@3.11.31)
// the path can also use `*` as a wildcard _and_ use semver:
// * > uglify-js@2.x
// The matchPath will break the `path` down into it's component parts, and loop
// through trying to get a positive match or not. For full examples of options
// see http://git.io/vCH3N
function matchPath(from, path) {
  var parts = path.split(' > ');
  debugProtect('checking path: %s vs. %s', path, from);
  var offset = 0;
  var res = parts.every(function (pkg, i) {
    debugProtect('for %s...(against %s)', pkg, from[i + offset]);
    var fromPkg = from[i + offset] ? moduleToObject(from[i + offset]) : {};

    if (pkg === '*') {
      debugProtect('star rule');

      // FIXME doesn't handle the rule being `*` alone
      if (!parts[i + 1]) {
        return true;
      }

      var next = moduleToObject(parts[i + 1]);

      // assuming we're not at the end of the rule path, then try to find
      // the next matching package in the chain. So `* > semver` matches
      // `foo > bar > semver`
      if (next) {
        debugProtect('next', next);
        // move forward until we find a matching package
        for (var j = i; i < parts.length; j++) {
          fromPkg = moduleToObject(from[i + offset]);
          debugProtect('fromPkg', fromPkg, next);

          if (next.name === fromPkg.name) {
            // adjust for the `i` index incrementing in the next .every call
            offset--;
            debugProtect('next has a match');
            break;
          }
          debugProtect('pushing offset');
          offset++;
        }
      }

      return true;
    }

    debugProtect('next test', pkg, fromPkg);

    if (pkg === from[i + offset]) {
      debugProtect('exact match');
      return true;
    }

    // if we're missing the @version - add @* so the pkg is foobar@*
    // so we have a good semver range
    if (pkg.indexOf('@') === -1) {
      pkg += '@*';
    }

    var pkgVersion = pkg.split('@').pop();

    if (semver.satisfies(fromPkg.version, pkgVersion)) {
      debugProtect('semver match');
      return true;
    }

    debugProtect('failed match');

    return false;
  });
  debugProtect('result of path test %s: %s', path, res);
  return res;
}

// note: cwd is optional and mostly used for testing
function patch(packages, live, cwd) {
  var lbl = 'Applying patches...';
  return spinner(lbl).then(function () {
    debug('patching %s', packages.length);

    var now = new Date();

    // find the patches, pull them down off the web, save them in a temp file
    // then apply each individual patch
    var promises = _.flatten(packages.map(function (vuln) {
      var patches = patchesForPackage(vuln, vuln);

      if (patches === null) {
        debug('no patch available for ' + vuln.id);
        return false;
      }

      var from = vuln.from.slice(1).map(function (pkg) {
        return moduleToObject(pkg).name;
      });

      // the target directory where our module name will live
      var source = path.resolve(
        cwd || process.cwd(),
        'node_modules',
        from.join('/node_modules/')
      );
      var flag = path.resolve(source, '.snyk-' + vuln.id + '.flag');

      // get the patches on the local fs
      var promises = patches.urls.map(function (url) {
        return new Promise(function (resolve, reject) {
          var filename = tempfile('.snyk-patch');
          debugProtect('GET %s', url);
          request(url)
            .on('end', function () {
              debugProtect('saved to %s', filename);
              resolve(filename);
            })
            .on('error', reject)
            .pipe(fs.createWriteStream(filename));

        }).then(function (patch) {
          // check whether there's a trace of us having patched before
          return fs.exists(flag).then(function (exists) {
            return exists ? false : patch;
          });
        }).then(function (patch) {
          if (patch === false) {
            debug('already patched %s', vuln.id);
            return vuln;
          }

          debug('applying patch file for %s: %s', vuln.id, patch);

          if (!live) {
            debug('[skipping - dry run]');
          }

          return applyPatch(patch, source, live).then(function () {
            debug('writing flag to %s', flag);
            return fs.writeFile(flag, now.toJSON(), 'utf8');
          }, function () {
            // this is a general "patch failed", since we already check if the
            // patch was applied via a flag, this means something else went
            // wrong, so we'll ask the user for help to diganose.
            var e = new Error(source + '\nEmail support@snyk.io if this ' +
              'problem persists?');
            e.code = 'FAIL_PATCH';
            console.log(chalk.red(errors.message(e)));
            return false;
            // return Promise.reject(e);
          }).then(function (ok) {
            return ok ? vuln : false;
          });
        });
      });

      return promises;
    }));

    var promise = Promise.all(promises).then(function (res) {
      var patched = res.filter(Boolean);

      var config = {};
      config.patch = patched.map(function (vuln) {
        var rule = {
          vulnId: vuln.id,
        };
        rule[vuln.from.slice(1).join(' > ')] = {
          patched: now.toJSON(),
        };
        return rule;
      }).reduce(function (acc, curr) {
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
  }).then(spinner.clear(lbl));
}

function applyPatch(patch, cwd, live) {
  return new Promise(function (resolve, reject) {

    var cmd = 'patch -p1 --backup --silent < ' + patch;

    if (!live) {
      cmd += ' --dry-run';
    }

    if (!cwd) {
      cwd = process.cwd();
    }

    debug('%s$ %s', cwd, cmd);

    exec(cmd, {
      cwd: cwd,
      env: process.env,
    }, function (error, stderr) {
      if (error) {
        debug('patch command failed', error);
        return reject(error);
      }

      if (stderr.trim()) {
        debug('patch failed', stderr.trim());
        return reject(new Error(stderr.trim()));
      }

      resolve();
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