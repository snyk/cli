module.exports = protect;

var Promise = require('es6-promise').Promise; // jshint ignore:line

var debug = require('debug')('snyk');
var moduleToObject = require('@snyk/module');
var snyk = require('../../lib/');
var semver = require('semver');
var inquirer = require('inquirer');
var npm = require('npm');

function protect(options) {
  if (!options) {
    options = {};
  }

  options['dry-run'] = true;

  if (options.interactive) {
    return interactive(options);
  }

  return snyk.dotfile.load().catch(function (error) {
    if (error.code === 'ENOENT') {
      error.code = 'MISSING_DOTFILE';
    }

    throw error;
  });
}

function interactive(options) {
  return snyk.test(process.cwd()).then(function (res) {
    if (res.ok) {
      return 'Nothing to be done. Well done, you.';
    }

    // find all the direct dependencies and ask if we can update their package
    // for them
    var install = findUpgrades(res.vulnerabilities.filter(function (vuln) {
      return vuln.upgradePath.filter(function (pkg, i) {
        // if the upgade path is to upgrade the module to the same range the
        // user already asked for, then it means we need to just blow that
        // module away and re-install
        if (pkg && vuln.from.length > i && pkg === vuln.from[i]) {
          return true;
        }

        // if the upgradePath contains the first two elements, that is
        // the project itself (i.e. jsbin) then the direct dependency can be
        // upgraded. Note that if the first two elements
        if (vuln.upgradePath.slice(0, 2).filter(Boolean).length) {
          return true;
        }

        return false;
      }).length;
    }));

    debug('reinstalls: %s', Object.keys(install).length);

    return new Promise(function (resolve, reject) {
      inquirer.prompt([{
        type: 'confirm',
        default: false,
        name: 'update',
        message: 'Do you want snyk to update your vulnerable dependencies?',
      }, ], function (answers) {
        var promises = [];

        if (answers.update) {
          npm.load({
            save: true, // save to the user's local package.json
          }, function (error, npm) {
            if (error) {
              return reject(error);
            }

            var installNames = Object.keys(install);
            var packages = installNames.reduce(function (acc, curr) {
              var version = install[curr].version;

              var text = 's';
              if (install[curr].count === 1) {
                text = '';
              }

              var res = {
                package: curr,
                version: version,
                optionLabel: curr + '@' + version + ' (fixes ' +
                  install[curr].count + ' vulnerable package' + text + ')',
              };

              if (acc[curr]) {
                if (semver.gt(acc[curr].version, version)) {
                  acc[curr] = res;
                }
              } else {
                acc[curr] = res;
              }

              return acc;
            }, {});

            // create a reverse lookup to allow the user to select a sensible
            // readable name, and then we can work out what that actually
            // relates to.
            var labelToPackage = {};
            var choices = installNames.map(function (name) {
              labelToPackage[packages[name].optionLabel] = name;
              return packages[name].optionLabel;
            });

            var all = 'All vulnerable packages';

            inquirer.prompt([{
              type: 'checkbox',
              choices: [all].concat(choices),
              name: 'packages',
              message: 'Select the packages you want to update',
            }, ], function (answers) {
              debug(answers)
              if (answers.packages.length === 0) {
                return resolve();
              }

              if (answers.packages[0] === all) {
                answers.packages = choices;
              }

              debug('to upgrade', answers.packages);
              var upgradeWithoutVersions = [];
              var upgrade = answers.packages.map(function (label) {
                var res = packages[labelToPackage[label]];
                upgradeWithoutVersions.push(res.package);
                return res.package + '@' + res.version;
              });
              promises.push(new Promise(function (resolve, reject) {
                debug('npm uninstall %s', upgradeWithoutVersions.join(' '));
                if (options['dry-run']) {
                  return resolve();
                }
                npm.commands.uninstall(Object.keys(install), function (error) {
                  if (error) {
                    return reject(error);
                  }
                  resolve();
                });
              }));

              promises.push(new Promise(function (resolve, reject) {
                debug('npm install %s', upgrade.join(' '));
                var res = { upgraded: upgrade };

                if (options['dry-run']) {
                  return resolve(res);
                }

                npm.commands.install(installNames, function (error) {
                  if (error) {
                    return reject(error);
                  }

                  resolve(res);
                });
              }));

              resolve(Promise.all(promises));
            });
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
      acc[curr.name] = {
        version: curr.version,
        count: 1,
      };
    } else if (semver.gt(curr.version, acc[curr.name].version)) {
      acc[curr.name].version = curr.version;
      acc[curr.name].count++;
    }

    return acc;
  }, {});
}