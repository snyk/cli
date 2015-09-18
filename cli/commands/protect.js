module.exports = protect;

var Promise = require('es6-promise').Promise; // jshint ignore:line

var debug = require('debug')('snyk');
var moduleToObject = require('@snyk/module');
var snyk = require('../../lib/');
var protect = require('../../lib/protect');
var semver = require('semver');
var inquirer = require('inquirer');

function protect(options) {
  if (!options) {
    options = {};
  }

  options['dry-run'] = true;

  if (options['dry-run']) {
    debug('*** dry run ****');
  } else {
    debug('~~~~ LIVE RUN ~~~~');
  }

  return snyk.dotfile.load().then(function (dotfile) {
    if (options.interactive) {
      return interactive(dotfile, options);
    }

    return 'nothing to do';
  }).catch(function (error) {
    if (error.code === 'ENOENT') {
      error.code = 'MISSING_DOTFILE';
    }

    throw error;
  });
}

function interactive(config, options) {
  return snyk.test(process.cwd()).then(function (res) {
    if (res.ok) {
      return 'Nothing to be done. Well done, you.';
    }

    // `install` will give us what to uninstall and which specific version to
    // newly install. within the .reduce loop, we'll also capture the list
    // of packages (in `patch`)  that we need to apply patch files to, to avoid
    // the vuln
    var patch = [];
    var install = findUpgrades(res.vulnerabilities.filter(function (vuln) {
      var res = !!vuln.upgradePath.filter(function (pkg, i) {
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

      // if there's no match on our conditions above, then it's a file that
      // needs a manual upgrade inside the package, so we capture it in our
      // patch array
      if (!res) {
        patch.push(vuln);
      }

      return res;
    }));


    // FIXME untested
    // reduce the patch list down to the unique, and the highest version that
    // we need to have installed to get out of the vuln range.
    patch = patch.reduce(function (acc, curr) {
      var patch = acc.filter(function (patch) {
        return patch.name === curr.name;
      }).pop(); // should either be undefined or length: 1

      // if patch, then this is a **reference** so we'll modify it
      if (patch) {
        patch.count++;
        if (semver.gt(curr.version, patch.version)) {
          patch.version = curr.version;
        }
      } else {
        patch = {
          count: 1,
          value: curr,
        };
        acc.push(patch);
      }

      patch.name = curr.name + '@' + curr.version +
        ' (' + patch.count + ' vulns)';

      return acc;
    }, []);


    debug('reinstalls: %s', Object.keys(install).length);
    debug('to patch: %s', patch.length);

    // turn the "to-install" list into an inquirer compatiable list, with
    // useful text labels (`.name`).
    var packages = Object.keys(install).reduce(function (acc, curr) {
      var version = install[curr].version;

      var text = 's';
      if (install[curr].count === 1) {
        text = '';
      }

      var res = {
        value: {
          package: curr,
          version: version,
        },
        name: curr + '@' + version + ' (fixes ' +
          install[curr].count + ' vulnerable package' + text + ')',
      };

      acc.push(res);

      return acc;
    }, []);

    var ignoreVulns = res.vulnerabilities.map(function (vuln) {
      var from = vuln.from.slice(1).filter(Boolean);
      var fromText = '';
      if (from.length === 1) {
        fromText = 'direct dependency';
      } else {
        fromText = from.join(' -> ');
      }
      return {
        name: vuln.name + '@' + vuln.version + ' (via ' + fromText + ')',
        checked: false,
        value: vuln,
      };
    });

    var all = {
      name: 'All vulnerable packages',
      value: '__all__',
    };

    debug('starting questions');

    return new Promise(function (resolve) {
      inquirer.prompt([{
        type: 'confirm',
        default: false,
        name: 'ignore',
        message: 'Do you want to ignore any vulnerabilities?',
      }, {
        type: 'checkbox',
        choices: ignoreVulns,
        name: 'ignore-vulns',
        message: 'Select the vulnerabilities you want to ignore',
        when: function (answers) {
          return answers.ignore;
        },
      }, {
        type: 'confirm',
        default: true,
        name: 'update',
        message: 'Do you want snyk to update your vulnerable dependencies?',
      }, {
        type: 'checkbox',
        choices: [all].concat(packages),
        name: 'packages',
        message: 'Select the packages you want to update',
        when: function (answers) {
          return answers.update;
        },
        filter: function (res) {
          // if they selected "all" then this is a hack to overwrite
          // our selection with the /actual/ selection of all
          if (res.length === 1 && res[0] === all.value) {
            res = packages;
          }
          return res;
        },
      }, {
        type: 'confirm',
        default: false,
        name: 'patch',
        message: 'Do you want snyk to patch your vulnerable dependencies?',
      }, {
        type: 'checkbox',
        choices: [all].concat(patch),
        name: 'patch-packages',
        message: 'Select the packages you want to apply patches to',
        when: function (answers) {
          return answers.patch;
        },
        filter: function (res) {
          if (res.length === 1 && res[0] === all.value) {
            res = patch;
          }
          return res;
        },
      }, ], function (answers) {
        var promises = [];

        debug('answers', answers);
        var ignore = answers['ignore-vulns'];

        if (answers.ignore && ignore.length) {
          promises.push(protect.ignore(ignore));
        }

        var packages = answers.packages.map(function (res) {
          return {
            package: res.value.package,
            version: res.value.version,
          };
        });

        if (answers.update && packages.length) {
          promises.push(protect.update(packages, !options['dry-run']));
        }

        var toPatch = answers['patch-packages'];
        if (answers.patch && toPatch.length) {
          promises.push(protect.patch(toPatch));
        }

        resolve(Promise.all(promises));

      });
    });

  });

}

function findUpgrades(packages) {
  return packages.map(function (vuln) {
    // ignoring the first element in the upgrade path, find the first non-false
    // entry in the array
    var path = vuln.upgradePath.slice(1).filter(Boolean).shift();

    return moduleToObject(path);
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