var protect = module.exports = {
  ignore: ignore,
  update: update,
  patch: patch,
  filterIgnored: filterIgnored,
  generateConfig: generateConfig,
};

var debug = require('debug')('snyk');
var debugProtect = require('debug')('snyk:protect');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var moduleToObject = require('@snyk/module');
var semver = require('semver');
var fs = require('then-fs');
var path = require('path');
var _ = require('lodash');
var exec = require('child_process').exec;
var username = require('./user-config').get('username') || process.env.USER;
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

    debug('ignore config', config);

    resolve(config);
  });
}

function update(packages, live) {
  return new Promise(function (resolve) {
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
      return resolve();
    }

    var promises = [
      npm('uninstall', _.unique(upgradeWithoutVersions), live),
      npm('install', findUpgrades(upgrade), live),
    ];

    resolve(Promise.all(promises));
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

      resolve();
    });
  });
}

// given an ignore ruleset (parsed from the .snyk yaml file) and a array of
// vulnerabilities, return the vulnerabilities that *are not* ignored
// see http://git.io/vCHmV for example of what ignore structure looks like
function filterIgnored(ignore, vuln) {
  var now = Date.now();

  return vuln.map(function (vuln) {
    if (!ignore[vuln.id]) {
      return vuln;
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
  return new Promise(function (resolve) {
    debug('patching %s', packages.length);

    var now = new Date();

    var promises = packages.map(function (vuln) {
      var patch = path.resolve(__dirname, '..', 'patches', vuln.id + '.diff');
      return fs.exists(patch).then(function (exists) {
        if (!exists) {
          debug('no patch available for ' + vuln.id);
          return false;
        }

        debug('found .diff file for %s', vuln.id);
        var from = vuln.from.slice(1).map(function (pkg) {
          return moduleToObject(pkg).name;
        });

        var source = path.resolve(
          cwd || process.cwd(),
          'node_modules',
          from.join('/node_modules/')
        );

        debug('applying patch...');
        if (!live) {
          debug('[skipping - dry run]');
        }
        return applyPatch(patch, source, live).then(function () {
          var flag = path.resolve(source, '.snyk-' + path.basename(patch));
          flag = flag.replace(/.diff$/, '.flag');
          debug('writing flag to %s', flag);
          return fs.writeFile(flag, now.getTime(), 'utf8');
        }, function (error) {
          // make the error actually a lot more useful
          var string = 'patching ' + vuln.name + ' failed.\n' +
            'source: ' + source + '\n' + error.message;
          return Promise.reject(new Error(string));
        }).then(function () {
          return vuln;
        });
      }, function (error) {
        debug('swallowing patch error (expecting no file)', error);
        // swallow a file not found, it's okay.
        return false;
      });
    });

    var promise = Promise.all(promises).then(function (res) {
      var patched = res.filter(Boolean);

      var config = {};
      config.patch = patched.map(function (vuln) {
        return {
          path: vuln.from.slice(1),
          patched: now,
          vulnId: vuln.id || id(vuln),
        };
      }).reduce(function (acc, curr) {
        if (acc[curr.vulnId]) {
          acc[curr.vulnId].path.push(curr.path.join(' > '));
        } else {
          acc[curr.vulnId] = {
            patched: curr.patched,
            path: [curr.path.join(' > ')],
          };
        }

        return acc;
      }, {});

      debug('patched', config);

      return config;
    });

    resolve(promise);
  });
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

function generateConfig(dotfileConfig, tasks, live) {
  var promises = [
    protect.ignore(tasks.ignore, live),
    protect.update(tasks.update, live),
    // protect.patch(tasks.patch, !options['dry-run']),
    // log(tasks, live),
  ];

  return Promise.all(promises).then(function (res) {
    // we're squashing the arrays of arrays into a flat structure
    // with only non-false values
    var results = _.flattenDeep(res).filter(Boolean);

    // then we merge the configs together using the original config
    // as the baseline (this lets us retain the user's existing config)
    results.unshift(dotfileConfig);
    var newConfig = _.merge.apply(_, results);

    debug(JSON.stringify(newConfig, '', 2));

    return newConfig;
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

    resolve(config);
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