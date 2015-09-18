module.exports = {
  ignore: ignore,
  update: update,
  patch: patch,
};

var debug = require('debug')('snyk');
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
        id: vuln.id || id(vuln),
      };
    });

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
    var have = acc.filter(function (package) {
      return package.name === curr.name;
    }).pop();

    if (have) {
      if (semver.gt(curr.version, have.version)) {
        have.version = curr.version;
      }
    } else {
      acc.push(curr);
    }

    return acc;
  }, []).map(function (package) {
    return package.name + '@' + package.version;
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

function patch() {
  return Promise.resolve('noop');

  // debug('patching', toPatch);

  // var patches = toPatch.map(function (package) {
  //   return Promise.resolve(package);
  // });

  // // merge the promises
  // [].push.apply(promises, patches);
}