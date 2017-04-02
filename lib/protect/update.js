module.exports = update;

var debug = require('debug')('snyk');
var chalk = require('chalk');
var _ = require('../../dist/lodash-min');
var moduleToObject = require('snyk-module');
var semver = require('semver');
var errors = require('../error');
var npm = require('../npm');
var yarn = require('../yarn');
var spinner = require('../spinner');

function update(packages, live, pkgManager) {
  pkgManager = pkgManager || 'npm';
  var lbl = 'Applying updates using ' + pkgManager + '...';
  var error = false;

  return spinner(lbl).then(function () {
    // the uninstall doesn't need versions in the strings
    // but install *does* so we build up arrays of both
    var upgradeWithoutVersions = [];

    var upgrade = packages
    .map(function (vuln) {
      var remediation = vuln.upgradePath.filter(Boolean)[0];
      upgradeWithoutVersions.push(remediation.split('@').shift());

      return {
        remediation: remediation,
        type: vuln.parentDepType || 'prod',
      };
    })
    .reduce(function (ups, vuln) {
      if (!ups[vuln.type]) {
        ups[vuln.type] = [];
      }
      ups[vuln.type].push(vuln.remediation);
      return ups;
    }, {});

    debug('to upgrade', upgrade);

    if (upgrade.length === 0) {
      return;
    }

    var toUninstall = _.unique(upgradeWithoutVersions);
    var promise = uninstall(pkgManager, toUninstall, live)
    .then(function () {
      var prodUpdate = (upgrade.prod ?
        install(pkgManager, findUpgrades(upgrade.prod), live) :
        Promise.resolve(true))
        .catch(function (e) {
          error = e;
          return false;
        });
      var devUpdate = (upgrade.dev ?
        installDev(pkgManager, findUpgrades(upgrade.dev), live) :
        Promise.resolve(true))
        .catch(function (e) {
          error = e;
          return false;
        });
      return Promise.all([prodUpdate, devUpdate])
      .then(function (results) {
        return results[0] && results[1];
      });
    });
    return promise;
  })
  .then(spinner.clear(lbl))
  .then(function (res) {
    if (error) {
      console.error(chalk.red(errors.message(error)));
    }
    return res;
  });
}

function install(pkgManager, upgrades, live) {
  return pkgManager === 'yarn' ?
    yarn('add', upgrades, live) :
    npm('install', upgrades, live);
}

function installDev(pkgManager, upgrades, live) {
  return pkgManager === 'yarn' ?
    yarn('add', upgrades, live, null, ['--dev']) :
    npm('install', upgrades, live, null, ['--save-dev']);
}

function uninstall(pkgManager, toUninstall, live) {
  return pkgManager === 'yarn' ?
    yarn('remove', toUninstall, live) :
    npm('uninstall', toUninstall, live);
}

function findUpgrades(packages) {
  return packages
  .map(moduleToObject)
  .reduce(function (acc, curr) {
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
  }, [])
  .map(function (pkg) {
    return pkg.name + '@' + pkg.version;
  });
}
