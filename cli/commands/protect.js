module.exports = protect;

var Promise = require('es6-promise').Promise; // jshint ignore:line

var debug = require('debug')('snyk');
var snyk = require('../../lib/');
var protect = require('../../lib/protect');
var getVersion = require('./version');
var inquirer = require('inquirer');
var path = require('path');
var fs = require('then-fs');
var _ = require('lodash');
var undefsafe = require('undefsafe');

function protect(options) {
  if (!options) {
    options = {};
  }

  if (options['dry-run']) {
    debug('*** dry run ****');
  } else {
    debug('~~~~ LIVE RUN ~~~~');
  }

  return snyk.dotfile.load().catch(function (error) {
    // if we land in the catch, but we're in interactive mode, then it means
    // the file hasn't been created yet, and that's fine, so we'll resolve
    // with an empty object
    if (options.interactive) {
      options.newDotFile = true;
      return {};
    }

    if (error.code === 'ENOENT') {
      error.code = 'MISSING_DOTFILE';
    }

    throw error;
  }).then(function (config) {
    if (options.interactive) {
      return interactive(config, options);
    }

    if (config.patch) {
      return patch(config.patch, options);
    }
    return 'Nothing to do';
  });
}

function patch(patches, options) {
  var ids = Object.keys(patches);

  return snyk.test(process.cwd()).then(function (res) {
    if (!res.vulnerabilities) {
      var e = new Error('Code is already patched');
      e.code = 'ALREADY_PATCHED';
      throw e;
    }
    return res.vulnerabilities.filter(function (vuln) {
      return ids.indexOf(vuln.id) !== -1;
    });
  }).then(function (res) {
    return protect.patch(res, !options['dry-run']);
  }).then(function () {
    return 'Successfully applied Snyk patches';
  }).catch(function (e) {
    if (e.code === 'ALREADY_PATCHED') {
      return e.message + ', nothing to do';
    }

    throw e;
  });
}

function interactive(config, options) {
  var cwd = process.cwd();
  return snyk.test(cwd).then(function (res) {
    if (res.ok) {
      return 'Nothing to be done. Well done, you.';
    }

    // `install` will give us what to uninstall and which specific version to
    // newly install. within the .reduce loop, we'll also capture the list
    // of packages (in `patch`)  that we need to apply patch files to, to avoid
    // the vuln
    var actions = [{
      value: 'skip', // the value that we get in our callback
      key: 'n',
      name: 'Do nothing', // the text the user sees
    }, {
      value: 'ignore',
      key: 'i',
      meta: { // arbitrary data that we'll merged into the `value` later on
        days: 30,
      },
      name: 'Ignore it for 30 days',
    }, ];

    var patchAction = {
      value: 'patch',
      key: 'p',
      name: 'Patch',
    };

    var updateAction = {
      value: 'update',
      key: 'u',
      name: null, // updated below to the name of the package to update
    };

    var prompts = res.vulnerabilities.map(function (vuln, i) {
      var id = vuln.id || ('node-' + vuln.name + '@' + vuln.below);

      id += '-' + i;

      // make complete copies of the actions, otherwise we'll mutate the object
      var choices = _.cloneDeep(actions);
      var patch = _.cloneDeep(patchAction);
      var update = _.cloneDeep(updateAction);

      var from = vuln.from.slice(1).filter(Boolean).shift();

      var res = {
        name: id,
        type: 'list',
        message: 'Fix vulnerability in ' + from +
          '\n  - from: ' + vuln.from.join(' > '),
      };


      var patches = null;
      if (vuln.patches && vuln.patches.length) {
        // check that the version we have has a patch available
        patches = protect.patchesForPackage({
          name: vuln.name,
          version: vuln.version,
        }, vuln);

        if (patches !== null) {
          debug('%s@%s', vuln.name, vuln.version, patches);
          choices.unshift(patch);
        }
      }

      if (patches === null) {
        // add a disabled option saying that patch isn't available
        // note that adding `disabled: true` does nothing, so the user can
        // actually select this option. I'm not 100% it's the right thing,
        // but we'll keep a keen eye on user feedback.
        choices.unshift({
          value: 'skip',
          key: 'p',
          name: 'Patch (no patch available for this vulnerability on ' +
            vuln.name + '@' + vuln.version + ')',
        });
      }

      var upgradeAvailable = vuln.upgradePath.some(function (pkg, i) {
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
      });

      // note: the language presented the user is "upgrade" rather than "update"
      // this change came long after all this code was written. I've decided
      // *not* to update all the variables referring to `update`, but just
      // to warn my dear code-reader that this is intentional.
      if (upgradeAvailable) {
        choices.unshift(update);
        update.name = 'Upgrade to ' + vuln.upgradePath.filter(Boolean).shift();
      } else {
        // No upgrade available (as per no patch)
        choices.unshift({
          value: 'skip',
          key: 'u',
          name: 'Upgrade (no direct upgrade available to sufficiently ' +
            'upgrade ' + vuln.name + '@' + vuln.version + ')',
        });
      }

      // kludge to make sure that we get the vuln in the user selection
      res.choices = choices.map(function (choice) {
        var value = choice.value;
        // this allows us to pass more data into the inquirer results
        choice.value = {
          meta: choice.meta,
          vuln: vuln,
          choice: value, // this is the string "update", "ignore", etc
        };
        return choice;
      });

      return res;
    });

    // zip together every prompt and a prompt asking "why", note that the `when`
    // callback controls whether not to prompt the user with this question,
    // in this case, we always show if the user choses to ignore.
    prompts = prompts.reduce(function (acc, curr) {
      acc.push(curr);
      acc.push({
        name: curr.name + '-reason',
        message: '[audit] Reason for ignoring vulnerability?',
        default: 'None given',
        when: function (answers) {
          return answers[curr.name].choice === 'ignore';
        },
      });
      return acc;
    }, []);

    var packageFile = path.resolve(cwd, 'package.json');

    return fs.readFile(packageFile, 'utf8')
      .then(JSON.parse)
      .then(function (pkg) {
      return new Promise(function (resolve) {
        debug('starting questions');
        inquirer.prompt(prompts.concat(nextSteps(pkg)), function (answers) {
          var tasks = {
            ignore: [],
            update: [],
            patch: [],
            skip: [],
          };

          Object.keys(answers).forEach(function (key) {
            // if we're looking at a reason, skip it
            if (key.indexOf('-reason') !== -1) {
              return;
            }

            // ignore misc questions, like "add snyk test to package?"
            if (key.indexOf('misc-') === 0) {
              return;
            }

            var answer = answers[key];
            var task = answer.choice;

            if (task === 'ignore') {
              answer.meta.reason = answers[key + '-reason'];
              tasks[task].push(answer);
            } else {
              tasks[task].push(answer.vuln);
            }
          });

          debug(tasks);

          var live = !options['dry-run'];
          var promise = protect.generateConfig(config, tasks, live);
          var snykVersion = '*';

          var res = promise.then(function (config) {
            if (!live) {
              // if this was a dry run, we'll throw an error to bail out of the
              // promise chain, then in the catch, check the error.code and if
              // it matches `DRYRUN` we'll return the text and not an error
              // (which avoids the exit code 1).
              var e = new Error('This was a dry run: nothing changed');
              e.code = 'DRYRUN';
              throw e;
            }

            return snyk.dotfile.save(config);
          })
          .then(function () {
            // re-read the package.json - because the generateConfig can apply
            // an `npm install` which will change the deps
            return fs.readFile(packageFile, 'utf8')
              .then(JSON.parse)
              .then(function (updatedPkg) {
                pkg = updatedPkg;
              });
          })
          .then(getVersion)
          .then(function (v) {
            debug('snyk version: %s', v);
            // little hack to circumvent local testing where the version will
            // be the git branch + commit
            if (v.match(/^\d+\./) === null) {
              v = '*';
            } else {
              v = '^' + v;
            }
            snykVersion = v;
          })
          .then(function () {
            if (!answers['misc-add-test']) {
              return;
            }

            debug('adding `snyk test` to package');

            if (!pkg.scripts) {
              pkg.scripts = {};
            }

            var test = pkg.scripts.test;
            var cmd = 'snyk test';
            if (test) {
              // only add the test if it's not already in the test
              if (test.indexOf(cmd) === -1) {
                pkg.scripts.test = cmd + ' && ' + test;
              }
            } else {
              pkg.scripts.test = cmd;
            }
          })
          .then(function () {
            if (!answers['misc-add-protect']) {
              return;
            }

            debug('adding `snyk protect` to package');

            if (!pkg.scripts) {
              pkg.scripts = {};
            }

            pkg.scripts['snyk-protect'] = 'snyk protect';

            var cmd = 'npm run snyk-protect';
            var postInstall = pkg.scripts.postinstall;
            if (postInstall) {
              // only add the postinstall if it's not already in the postinstall
              if (postInstall.indexOf(cmd) === -1) {
                pkg.scripts.postinstall = cmd + '; ' + postInstall;
              }
            } else {
              pkg.scripts.postinstall = cmd;
            }

            pkg.snyk = true;
          })
          .then(function () {
            if (answers['misc-add-test'] || answers['misc-add-protect']) {
              debug('updating %s', packageFile);

              // finally, add snyk as a dependency because they'll need it
              // during the protect process
              var depLocation = 'dependencies';

              if (!pkg[depLocation]) {
                pkg[depLocation] = {};
              }

              if (!pkg[depLocation].snyk) {
                pkg[depLocation].snyk = snykVersion;
              }

              return fs.writeFile(packageFile, JSON.stringify(pkg, '', 2));
            }
          })
          .then(function () {
            if (answers['misc-run-monitor']) {
              debug('running monitor');
              return snyk.modules(cwd).then(snyk.monitor.bind(null, {
                method: 'protect interactive',
              }));
            }
          })
          .then(function () {
            return options.newDotFile ?
              // if it's a newly created file
              'A .snyk file has been created with the actions you\'ve ' +
                'selected, add it to your source control (`git add .snyk`).' :
              // otherwise we updated it
              'Your .snyk file has been successfully updated.';
          })
          .catch(function (error) {
            // if it's a dry run - exit with 0 status
            if (error.code === 'DRYRUN') {
              return error.message;
            }

            throw error;
          });

          resolve(res);
        });
      });
    });

  });

}

function nextSteps(pkg) {
  var i;
  var prompts = [{
    name: 'misc-run-monitor',
    message: 'Capture a snapshot of your dependencies to be notified about ' +
      'new related vulnerabilities?',
    type: 'confirm',
    default: true,
  }, ];

  i = (undefsafe(pkg, 'scripts.test') || '').indexOf('snyk test');
  if (i === -1) {
    prompts.push({
      name: 'misc-add-test',
      message: 'Add `snyk test` to package.json file to fail test on newly ' +
        'disclosed vulnerabilities?',
      type: 'confirm',
      default: true,
    });
  }

  i = (undefsafe(pkg, 'scripts.postinstall') || '').indexOf('snyk pro');
  if (i === -1) {
    prompts.push({
      name: 'misc-add-protect',
      message: 'Add `snyk protect` as package.json post-install step to apply' +
        ' chosen patches on install?',
      type: 'confirm',
      when: function (answers) {
        return Object.keys(answers).some(function (key) {
          return answers[key].choice === 'patch';
        });
      },
      default: true,
    });
  }

  return prompts;
}