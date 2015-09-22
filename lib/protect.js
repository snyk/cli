module.exports = {
  ignore: ignore,
  update: update,
  patch: patch,
  filterIgnored: filterIgnored,
};

var debug = require('debug')('snyk');
var debugProtect = require('debug')('snyk:protect');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var snyk = require('./');
var moduleToObject = require('@snyk/module');
var semver = require('semver');
var npm = require('npm');
var _ = require('lodash');
var thirtyDays = 1000 * 60 * 60 * 24 * 30;

// FIXME remove!!!
function id(vuln) {
  var rnd = parseInt((Math.random() + '').split('.').pop(), 10)
            .toString(16).slice(0, 6);
  return 'node-' + vuln.name + '-' + rnd;
}

function ignore(vulns) {
  return new Promise(function (resolve) {
    var config = {};
    config.ignore = vulns.map(function (vuln) {
      return {
        path: vuln.from.slice(1),
        expires: new Date(Date.now() + thirtyDays),
        vulnId: vuln.id || id(vuln),
      };
    }).reduce(function (acc, curr) {
      if (acc[curr.vulnId]) {
        acc[curr.vulnId].path.push(curr.path.join(' > '));
      } else {
        acc[curr.vulnId] = {
          expires: curr.expires,
          path: [curr.path.join(' > ')],
        };
      }

      return acc;
    }, {});

    // FIXME should merge, not oblitorate
    resolve(snyk.dotfile.save(config));
  });
}

function update(packages, live) {
  return new Promise(function (resolve, reject) {
    npm.load({
      save: true, // save to the user's local package.json
    }, function (error, npm) {
      if (error) {
        return reject(error);
      }


      // the uninstall doesn't need versions in the strings
      // but install *does* so we build up arrays of both
      var upgradeWithoutVersions = [];
      var upgrade = packages.map(function (vuln) {
        var remediation = vuln.upgradePath.slice(1).shift();
        upgradeWithoutVersions.push(remediation.split('@').shift());
        return remediation;
      });

      debug('to upgrade', upgrade);
      // TODO:
      // - remove dupes form upgradeWithoutVersions
      // - find highest remediation in a package

      var promises = [
        npmit('uninstall', npm, _.unique(upgradeWithoutVersions), live),
        npmit('install', npm, findUpgrades(upgrade), live),
      ];

      resolve(Promise.all(promises));
    });
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

function npmit(method, npm, packages, live) {
  return new Promise(function (resolve, reject) {
    debug('npm ' + method + ' %s', packages.join(' '));
    if (!live) {
      debug('[skipping - dry run]');
      return resolve();
    }
    npm.commands[method](packages, function (error) {
      if (error) {
        return reject(error);
      }
      resolve();
    });
  });
}

function filterIgnored(ignore, vuln) {
  var now = Date.now();

  return vuln.map(function (vuln) {
    var rules = ignore[vuln.id];


    if (!rules) {
      return vuln;
    }

    if (rules.expires < now) {
      debug('%s vuln rule has expired (%s)', vuln.id, rules.expires);
      return vuln;
    }

    // now check the path
    var from = vuln.from.slice(1);
    var path = rules.path.slice(0); // copy
    if (path.indexOf(from.join(' > ')) !== -1) {
      debug('%s exact match from %s', vuln.id, from);
      return false;
    }

    var ignored = path.some(function (path) {
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
    });

    if (ignored) {
      debug('ignoring based on path match: %s ~= %s', path, from.join(' > '));
      return false;
    }

    return vuln;
  }).filter(Boolean);
}

function patch() {
  return Promise.resolve('noop');

  // debug('patching', toPatch);

  // var patches = toPatch.map(function (package) {
  //   return Promise.resolve(package);
  // });

  // // merge the promises
  // [].push.apply(promises, patches);
}