module.exports = wizard;
// used for testing
module.exports.processAnswers = processAnswers;
module.exports.inquire = inquire;
module.exports.interactive = interactive;

var Promise = require('es6-promise').Promise; // jshint ignore:line

var debug = require('debug')('snyk');
var path = require('path');
var inquirer = require('inquirer');
var fs = require('then-fs');
var tryRequire = require('snyk-try-require');
var chalk = require('chalk');
var url = require('url');
var _ = require('../../../dist/lodash-min');
var exec = require('child_process').exec;
var undefsafe = require('undefsafe');
var auth = require('../auth');
var getVersion = require('../version');
var allPrompts = require('./prompts');
var answersToTasks = require('./tasks');
var snyk = require('../../../lib/');
var isCI = require('../../../lib/is-ci');
var protect = require('../../../lib/protect');
var config = require('../../../lib/config');
var spinner = require('../../../lib/spinner');
var analytics = require('../../../lib/analytics');
var npm = require('../../../lib/npm');
var cwd = process.cwd();
var detectPackageManager = require('../../../lib/detect').detectPackageManager;

function wizard(options) {
  if (!options) {
    options = {};
  }

  try {
    if (detectPackageManager(cwd, options) === 'rubygems') {
      throw new Error(
        'Snyk wizard for Ruby projects is not currently supported');
    }
  } catch (error) {
    return Promise.reject(error);
  }

  spinner.sticky();

  if (options['dry-run']) {
    debug('*** dry run ****');
  } else {
    debug('~~~~ LIVE RUN ~~~~');
  }

  return snyk.policy.load(options).catch(function (error) {
    // if we land in the catch, but we're in interactive mode, then it means
    // the file hasn't been created yet, and that's fine, so we'll resolve
    // with an empty object
    if (error.code === 'ENOENT') {
      options.newPolicy = true;
      return snyk.policy.create();
    }

    throw error;
  }).then(function (policy) {
    return auth.isAuthed().then(function (authed) {
      analytics.add('inline-auth', !authed);
      if (!authed) {
        return auth(null, 'wizard');
      }
    }).then(function () {
      var intro = __dirname + '/../../../help/wizard-intro.txt';
      return fs.readFile(intro, 'utf8').then(function (str) {
        if (!isCI) {
          console.log(str);
        }
      }).then(function () {
        return new Promise(function (resolve) {
          if (options.newPolicy) {
            return resolve(); // don't prompt to start over
          }
          inquirer.prompt(allPrompts.startOver()).then(function (answers) {
            analytics.add('start-over', answers['misc-start-over']);
            if (answers['misc-start-over']) {
              options['ignore-policy'] = true;
            }

            resolve();
          });
        });
      }).then(function () {
        return snyk.test(cwd, options).then(function (res) {
          var packageFile = path.resolve(cwd, 'package.json');

          if (!res.ok) {
            var vulns = res.vulnerabilities;
            var paths = vulns.length === 1 ? 'path' : 'paths';
            var ies = vulns.length === 1 ? 'y' : 'ies';
            // echo out the deps + vulns found
            console.log('Tested %s dependencies for known vulnerabilities, %s',
              res.dependencyCount,
              chalk.bold.red('found ' +
                res.uniqueCount +
                ' vulnerabilit' + ies +
                ', ' + vulns.length +
                ' vulnerable ' +
                paths + '.'));
          } else {
            console.log(chalk.green('✓ Tested %s dependencies for known ' +
              'vulnerabilities, no vulnerable paths found.'),
              res.dependencyCount);
          }

          return tryRequire(packageFile).then(function (pkg) {
            options.packageLeading = pkg.prefix;
            options.packageTrailing = pkg.suffix;
            return interactive(res, pkg, policy).then(function (answers) {
              return processAnswers(answers, policy, options);
            });
          });
        });
      });
    });
  });
}

function interactive(test, pkg, policy) {
  var vulns = test.vulnerabilities;
  if (!policy) {
    policy = {};
  }

  if (!pkg) { // only really happening in tests
    pkg = {};
  }

  return new Promise(function (resolve) {
    debug('starting questions');
    var prompts = allPrompts.getUpdatePrompts(vulns, policy);
    resolve(inquire(prompts, {}));
  }).then(function (answers) {
    var prompts = allPrompts.getPatchPrompts(vulns, policy);
    return inquire(prompts, answers);
  }).then(function (answers) {
    var prompts = allPrompts.getIgnorePrompts(vulns, policy);
    return inquire(prompts, answers);
  }).then(function (answers) {
    var prompts = allPrompts.nextSteps(pkg, test.ok ? false : answers);
    return inquire(prompts, answers);
  }).then(function (answers) {
    if (pkg.shrinkwrap) {
      answers['misc-build-shrinkwrap'] = true;
    }
    return answers;
  });
}

function inquire(prompts, answers) {
  if (prompts.length === 0) {
    return Promise.resolve(answers);
  }
  return new Promise(function (resolve) {
    inquirer.prompt(prompts).then(function (theseAnswers) {
      _.extend(answers, theseAnswers);
      resolve(answers);
    });
  });
}

function processAnswers(answers, policy, options) {
  if (!options) {
    options = {};
  }
  options.packageLeading = options.packageLeading || '';
  options.packageTrailing = options.packageTrailing || '';
  // allow us to capture the answers the users gave so we can combine this
  // the scenario running
  if (options.json) {
    return Promise.resolve(JSON.stringify(answers, '', 2));
  }

  var cwd = process.cwd();
  var packageFile = path.resolve(cwd, 'package.json');

  var pkg = {};

  analytics.add('answers', Object.keys(answers).map(function (key) {
    // if we're looking at a reason, skip it
    if (key.indexOf('-reason') !== -1) {
      return;
    }

    // ignore misc questions, like "add snyk test to package?"
    if (key.indexOf('misc-') === 0) {
      return;
    }

    var answer = answers[key];
    var res = {
      vulnId: answer.vuln.id,
      choice: answer.choice,
      from: answer.vuln.from.slice(1),
    };

    if (answer.vuln.grouped) {
      res.batchMain = !!answer.vuln.grouped.main;
      res.batch = true;
    }

    return res;
  }).filter(Boolean));

  var tasks = answersToTasks(answers);
  debug(tasks);

  var live = !options['dry-run'];
  var snykVersion = '*';

  var res = protect.generatePolicy(policy, tasks, live)
  .then(function (policy) {
    if (!live) {
      // if this was a dry run, we'll throw an error to bail out of the
      // promise chain, then in the catch, check the error.code and if
      // it matches `DRYRUN` we'll return the text and not an error
      // (which avoids the exit code 1).
      var e = new Error('This was a dry run: nothing changed');
      e.code = 'DRYRUN';
      throw e;
    }

    return policy.save(cwd, spinner).then(function () {
      // don't do this during testing
      if (isCI || process.env.TAP) {
        return Promise.resolve();
      }

      return new Promise(function (resolve) {
        exec('git add .snyk', {
          cwd: cwd,
        }, function (error, stdout, stderr) {
          if (error) {
            debug('error adding .snyk to git', error);
          }

          if (stderr) {
            debug('stderr adding .snyk to git', stderr.trim());
          }

          // resolve either way
          resolve();
        });
      });
    });
  })
  .then(function () {
    // re-read the package.json - because the generatePolicy can apply
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
    analytics.add('add-snyk-test', answers['misc-add-test']);
    if (!answers['misc-add-test']) {
      return;
    }

    debug('adding `snyk test` to package');

    if (!pkg.scripts) {
      pkg.scripts = {};
    }

    var test = pkg.scripts.test;
    var cmd = 'snyk test';
    if (test && test !== 'echo "Error: no test specified" && exit 1') {
      // only add the test if it's not already in the test
      if (test.indexOf(cmd) === -1) {
        pkg.scripts.test = cmd + ' && ' + test;
      }
    } else {
      pkg.scripts.test = cmd;
    }
  })
  .then(function () {
    analytics.add('add-snyk-protect', answers['misc-add-protect']);
    if (!answers['misc-add-protect']) {
      return;
    }

    debug('adding `snyk protect` to package');

    if (!pkg.scripts) {
      pkg.scripts = {};
    }

    pkg.scripts['snyk-protect'] = 'snyk protect';

    var cmd = 'npm run snyk-protect';
    var runScript = pkg.scripts.prepublish;
    if (runScript) {
      // only add the prepublish if it's not already in the prepublish
      if (runScript.indexOf(cmd) === -1) {
        pkg.scripts.prepublish = cmd + '; ' + runScript;
      }
    } else {
      pkg.scripts.prepublish = cmd;
    }

    // legacy check for `postinstall`, if `npm run snyk-protect` is in there
    // we'll replace it with `true` so it can be cleanly swapped out
    var postinstall = pkg.scripts.postinstall;
    if (postinstall && postinstall.indexOf(cmd) !== -1) {
      pkg.scripts.postinstall = postinstall.replace(cmd, 'true');
    }

    pkg.snyk = true;
  })
  .then(function () {
    var lbl = 'Updating package.json...';
    if (answers['misc-add-test'] || answers['misc-add-protect']) {
      debug('updating %s', packageFile);


      if (undefsafe(pkg, 'dependencies.snyk') ||
          undefsafe(pkg, 'peerDependencies.snyk') ||
          undefsafe(pkg, 'optionalDependencies.snyk')) {
        // nothing to do as the user already has Snyk
        // TODO decide whether we should update the version being used
        // and how do we reconcile if the global install is older
        // than the local version?
      } else {
        if (answers['misc-add-protect']) {
          if (!pkg.dependencies) {
            pkg.dependencies = {};
          }
          pkg.dependencies.snyk = snykVersion;
          lbl = 'Adding Snyk to production dependencies ' +
                '(used by snyk protect)';

          // but also check if we should remove it from devDependencies
          if (undefsafe(pkg, 'devDependencies.snyk')) {
            delete pkg.devDependencies.snyk;
          }
        } else if (!undefsafe(pkg, 'devDependencies.snyk')) {
          if (!pkg.devDependencies) {
            pkg.devDependencies = {};
          }
          lbl = 'Adding Snyk to devDependencies (used by npm test)';
          pkg.devDependencies.snyk = snykVersion;
        }
      }
    }

    if (answers['misc-add-test'] || answers['misc-add-protect'] ||
          tasks.update.length) {
      var packageString = options.packageLeading + JSON.stringify(pkg, '', 2) +
                          options.packageTrailing;
      return spinner(lbl)
        .then(fs.writeFile(packageFile, packageString))
        .then(spinner.clear(lbl));
    }
  })
  .then(function () {
    if (answers['misc-build-shrinkwrap'] && tasks.update.length) {
      debug('updating shrinkwrap');

      var lbl = 'Updating npm-shrinkwrap.json...';
      return spinner(lbl)
        .then(npm.bind(null, 'shrinkwrap', null, live, cwd, null))
        .then(spinner.clear(lbl));
    }
  })
  .then(function () {
    if (answers['misc-test-no-monitor']) { // allows us to automate tests
      return {
        id: 'test',
      };
    }

    debug('running monitor');
    var lbl = 'Remembering current dependencies for future ' +
      'notifications...';
    return snyk.modules(cwd)
      .then(spinner(lbl))
      .then(snyk.monitor.bind(null, cwd, {
        method: 'wizard',
      }))
      .then(spinner.clear(lbl));
  })
  .then(function (monitorRes) {
    var endpoint = url.parse(config.API);
    var leader = '';
    if (monitorRes.org) {
      leader = '/org/' + monitorRes.org;
    }
    endpoint.pathname = leader + '/monitor/' + monitorRes.id;
    var monitorUrl = url.format(endpoint);
    endpoint.pathname = leader + '/manage';
    var manageUrl = url.format(endpoint);

    return (options.newPolicy ?
      // if it's a newly created file
      '\nYour policy file has been created with the actions you\'ve ' +
        'selected, add it to your source control (`git add .snyk`).' :
      // otherwise we updated it
      '\nYour .snyk policy file has been successfully updated.') +
      '\nTo review your policy, run `snyk policy`.\n\n' +
      'You can see a snapshot of your dependencies here:\n' +
      monitorUrl + '\n\n' +
      (monitorRes.isMonitored ?
      'We\'ll notify you when relevant new vulnerabilities are ' +
      'disclosed.\n\n' :
      chalk.bold.red('Project is inactive, so notifications are turned off.\n' +
      'Activate this project here: ' + manageUrl + '\n')) +
      (monitorRes.trialStarted ?
      chalk.yellow('You\'re over the free plan usage limit, \n' +
      'and are now on a free 14-day premium trial.\n' +
      'View plans here: ' + manageUrl + '\n\n') :
      '');
  })
  .catch(function (error) {
    // if it's a dry run - exit with 0 status
    if (error.code === 'DRYRUN') {
      return error.message;
    }

    throw error;
  });

  return res;
}
