module.exports.update = update;
module.exports.install = install;
module.exports.installDev = installDev;

const util = require('util');
const debug = util.debuglog('snyk');
const chalk = require('chalk');
const uniq = require('lodash.uniq');
const isEmpty = require('lodash.isempty');
const { parsePackageString: moduleToObject } = require('snyk-module');
const semver = require('semver');
const errors = require('../errors/legacy-errors');
const npm = require('../npm');
const { yarn } = require('../yarn');
const spinner = require('../spinner');
const analytics = require('../analytics');

function update(packages, live, pkgManager) {
  pkgManager = pkgManager || 'npm';
  const lbl = 'Applying updates using ' + pkgManager + '...';
  let error = false;

  return (
    spinner(lbl)
      .then(() => {
        const upgrade = packages
          .map((vuln) => {
            const remediation = vuln.upgradePath && vuln.upgradePath[1];
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
          .reduce((ups, vuln) => {
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
          console.error(
            chalk.yellow(
              'Extraneous packages were selected for ' +
                'update, but will be skipped. These dependencies introduce ' +
                'vulnerabilities. Please remove the dependencies with `npm prune`, ' +
                'or install properly as prod or dev dependencies:',
              upgrade.extraneous.join(', '),
            ),
          );
        }

        const promise = Promise.resolve()
          .then(() => {
            // create list of unique package names _without versions_ for uninstall
            // skip extraneous packages, if any
            const prodToUninstall =
              (upgrade.prod && upgrade.prod.map(stripVersion)) || [];
            const devToUninstall =
              (upgrade.dev && upgrade.dev.map(stripVersion)) || [];
            const toUninstall = uniq(prodToUninstall.concat(devToUninstall));
            debug('to uninstall', toUninstall);

            if (!isEmpty(toUninstall)) {
              return uninstall(pkgManager, toUninstall, live);
            }
          })
          .then(() => {
            const prodUpdate = (upgrade.prod
              ? install(pkgManager, findUpgrades(upgrade.prod), live)
              : Promise.resolve(true)
            ).catch((e) => {
              error = e;
              return false;
            });
            const devUpdate = (upgrade.dev
              ? installDev(pkgManager, findUpgrades(upgrade.dev), live)
              : Promise.resolve(true)
            ).catch((e) => {
              error = e;
              return false;
            });
            return Promise.all([prodUpdate, devUpdate]).then((results) => {
              return results[0] && results[1];
            });
          });
        return promise;
      })
      // clear spinner in case of success or failure
      .then(spinner.clear(lbl))
      .catch((error) => {
        spinner.clear(lbl)();
        throw error;
      })
      .then((res) => {
        if (error) {
          console.error(chalk.red(errors.message(error)));
          debug(error.stack);
        }
        return res;
      })
  );
}

function install(pkgManager, upgrades, live) {
  return pkgManager === 'yarn'
    ? yarn('add', upgrades, live)
    : npm('install', upgrades, live);
}

function installDev(pkgManager, upgrades, live) {
  return pkgManager === 'yarn'
    ? yarn('add', upgrades, live, null, ['--dev'])
    : npm('install', upgrades, live, null, ['--save-dev']);
}

function uninstall(pkgManager, toUninstall, live) {
  return pkgManager === 'yarn'
    ? yarn('remove', toUninstall, live)
    : npm('uninstall', toUninstall, live);
}

function findUpgrades(packages) {
  return packages
    .map(moduleToObject)
    .reduce((acc, curr) => {
      const have = acc
        .filter((pkg) => {
          return pkg.name === curr.name;
        })
        .pop();

      if (have) {
        if (semver.gt(curr.version, have.version)) {
          have.version = curr.version;
        }
      } else {
        acc.push(curr);
      }

      return acc;
    }, [])
    .map((pkg) => {
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
