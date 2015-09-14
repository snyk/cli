module.exports = protect;

var Promise = require('es6-promise').Promise; // jshint ignore:line

var debug = require('debug')('snyk');
var moduleToObject = require('@snyk/module');
var snyk = require('../../lib/');
var semver = require('semver');
var inquirer = require('inquirer');
var validator = require('validator');
var request = require('request');
var npm = require('npm');
var _ = require('lodash');

function protect(opts) {
  if (!opts) {
    opts = {};
  }

  if (opts.interactive) {
    return interactive();
  }

  return snyk.dotfile.load().catch(function (error) {
    if (error.code === 'ENOENT') {
      error.code = 'MISSING_DOTFILE';
    }

    throw error;
  });
}

function interactive() {
  return snyk.test(process.cwd()).then(function (res) {
    if (res.ok) {
      return 'Nothing to be done. Well done, you.';
    }

    // find all the direct dependencies and ask if we can update their package
    // for them
    var uninstall = findUpgrades(res.vulnerabilities.filter(function (vuln) {
      return vuln.upgradePath.filter(function (pkg, i) {
        // if the upgade path is to upgrade the module to the same range the
        // user already asked for, then it means we need to just blow that
        // module away and re-install
        return (pkg && vuln.from.length > i && pkg === vuln.from[i]);
      }).length;
    }));

    debug('reinstalls: %s', Object.keys(uninstall).length);

    var install = findUpgrades(res.vulnerabilities.filter(function (vuln) {
      // if the upgradePath contains the first two elements, that is
      // the project itself (i.e. jsbin) then the direct dependency can be
      // upgraded. Note that if the first two elements
      return vuln.upgradePath.slice(0, 2).filter(Boolean).length;
    }));

    debug('direct dependency installs: %s', Object.keys(install).length);

    return new Promise(function (resolve, reject) {
      inquirer.prompt([{
        type: 'confirm',
        default: false,
        name: 'update',
        message: 'Do you want snyk to update your vulnerable dependencies?',
      }, ], function (answers) {
        var promises = [];

        if (answers.update) {
          npm.load({ save: true }, function (error, npm) {
            if (error) {
              return reject(error);
            }

            // 1. work out which modules to uninstall and re-install
            var uninstallNames = Object.keys(uninstall);

            debug('npm uninstall %s', uninstallNames.join(' '));

            if (uninstallNames.length) {
              promises.push(new Promise(function (resolve, reject) {
                debug('command: npm uninstall');
                npm.commands.uninstall(uninstallNames, function (error) {
                  if (error) {
                    return reject(error);
                  }
                  resolve();
                });
              }));

              // now add all the uninstalled packages to the list of packages
              // we need to install
              uninstallNames.forEach(function (name) {
                if (install[name]) {
                  if (semver.gt(uninstall[name], install[name])) {
                    install[name] = uninstall[name];
                  }
                } else {
                  install[name] = uninstall[name];
                }
              });
            }

            var installNames = Object.keys(install).map(function (name) {
              return name + '@' + install[name];
            });

            debug('npm install %s', installNames.join(' '));

            if (installNames.length) {
              promises.push(new Promise(function (resolve, reject) {
                debug('command: npm install');
                npm.commands.install(installNames, function (error) {
                  if (error) {
                    return reject(error);
                  }

                  resolve();
                });
              }));
            }

            // TODO update the local package.json

            resolve(Promise.all(promises).then(function () {
              return '\n\nSnyk updated package.json to\n - ' + installNames.join('\n - ');
            }));
          });
        } else {
          resolve('Listing modules to patch');
        }

      });
    });

  });

}

function findUpgrades(packages) {
  return packages.map(function (vuln) {
    return moduleToObject(vuln.upgradePath[1]);
  }).reduce(function (acc, curr) {
    if (!acc[curr.name]) {
      acc[curr.name] = curr.version;
    } else if (semver.gt(curr.version, acc[curr.name])) {
      acc[curr.name] = curr.version;
    }

    return acc;
  }, {});
}