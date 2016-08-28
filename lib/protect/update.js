module.exports = update;

var debug = require('debug')('snyk');
var chalk = require('chalk');
var _ = require('../../dist/lodash-min');
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

      return {
        remediation: remediation,
        type: vuln.parentDepType || 'prod',
      };
    }).reduce(function (ups, vuln) {
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
    var promise = npm('uninstall', toUninstall, live).then(function () {
      var prodUpdate = (upgrade.prod ?
        npm('install', findUpgrades(upgrade.prod), live) :
        Promise.resolve(true)).catch(function (e) {
        error = e;
        return false;
      });
      var devUpdate = (upgrade.dev ?
        npm('install', findUpgrades(upgrade.dev), live, null, ['--save-dev']) :
        Promise.resolve(true)).catch(function (e) {
        error = e;
        return false;
      });
      return Promise.all([prodUpdate, devUpdate]).then(function (results) {
        return results[0] && results[1];
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
