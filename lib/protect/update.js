module.exports = update;

var debug = require('debug')('snyk');
var chalk = require('chalk');
var _ = require('lodash');
var moduleToObject = require('snyk-module');
var semver = require('semver');
var errors = require('../error');
var npm = require('../npm');
var spinner = require('../spinner');

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
