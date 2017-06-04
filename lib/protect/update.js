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
var analytics = require('../analytics');

function update(packages, live, pkgManager) {
  pkgManager = pkgManager || 'npm';
  var lbl = 'Applying updates using ' + pkgManager + '...';
  var error = false;

  return spinner(lbl).then(function () {
    var upgrade = packages
    .map(function (vuln) {
      var remediation = vuln.upgradePath[1];
      if (!remediation) {
        // this vuln holds an unreachable upgrade path - send this to analytics
        // and return an empty object to be filtered
        analytics.add('bad-upgrade-path', vuln);
        return null;
      }

      return {
        remediation: remediation,
        type: vuln.parentDepType || 'prod',
      };
    })
    .filter(Boolean)
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

    // warn if extraneous packages were selected for update
    if (upgrade.extraneous) {
      console.error(chalk.yellow('Extraneous packages were selected for ' +
        'update, but will be skipped. These dependencies introduce ' +
        'vulnerabilities. Please remove the dependencies with `npm prune`, ' +
        'or install properly as prod or dev dependencies:',
        upgrade.extraneous.join(', ')
      ));
    }

    var promise = Promise.resolve()
    .then(function () {
      // create list of unique package names _without versions_ for uninstall
      // skip extraneous packages, if any
      var prodToUninstall = (upgrade.prod && upgrade.prod.map(stripVersion)) ||
                            [];
      var devToUninstall = (upgrade.dev && upgrade.dev.map(stripVersion)) ||
                           [];
      var toUninstall = _.unique(prodToUninstall.concat(devToUninstall));

      debug('to uninstall', toUninstall);
      return uninstall(pkgManager, toUninstall, live);
    })
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

function stripVersion(pkg) {
  if (!pkg) {
    return;
  }

  // scoped packages like @snyk/module@1.0.0
  if (pkg.startsWith('@')) {
    return '@' + pkg.split('@')[1];
  }

  // non-scoped packages like snyk@1.2.3
  if (pkg.indexOf('@') > 0) {
    return pkg.split('@').shift();
  }

  // versionless packages like tap
  return pkg;
}
