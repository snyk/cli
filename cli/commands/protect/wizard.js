module.exports = wizard;
// used for testing
module.exports.processAnswers = processAnswers;

var Promise = require('es6-promise').Promise; // jshint ignore:line

var debug = require('debug')('snyk');
var auth = require('../auth');
var getVersion = require('../version');
var inquirer = require('inquirer');
var path = require('path');
var fs = require('then-fs');
var allPrompts = require('./prompts');
var snyk = require('../../../lib/');
var protect = require('../../../lib/protect');
var config = require('../../../lib/config');
var url = require('url');
var chalk = require('chalk');
var spinner = require('../../../lib/spinner');
var cwd = process.cwd();

function wizard(options) {
  if (!options) {
    options = {};
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
      return {};
    }

    throw error;
  }).then(function (policy) {
    return auth.isAuthed().then(function (authed) {
      if (!authed) {
        throw new Error('Unauthorized');
      }

      var intro = __dirname + '/../../../help/wizard-intro.txt';
      return fs.readFile(intro, 'utf8').then(function (str) {
        console.log(str);
      }).then(function () {
        return new Promise(function (resolve) {
          if (options.newPolicy) {
            return resolve(); // don't prompt to start over
          }
          inquirer.prompt(allPrompts.startOver(), function (answers) {
            if (answers['misc-start-over']) {
              options['ignore-policy'] = true;
            }

            resolve();
          });
        });
      }).then(function () {
        return snyk.test(cwd, options).then(function (res) {
          var prompts = [];
          var packageFile = path.resolve(cwd, 'package.json');

          if (!res.ok) {
            var vulns = res.vulnerabilities;
            // echo out the deps + vulns found
            console.log('Tested %s dependencies for known vulnerabilities, %s',
              res.dependencyCount,
              chalk.bold.red('found ' + vulns.length + ' vulnerabilities.'));

            prompts = allPrompts.getPrompts(vulns, policy);
          } else {
            console.log(chalk.green('✓ Tested %s dependencies for known ' +
              'vulnerabilities, no vulnerabilities found.'),
              res.dependencyCount);
          }


          return fs.readFile(packageFile, 'utf8')
            .then(JSON.parse)
            .then(function (pkg) {

            // we're fine, but we still want to ask the user if they wanted to
            // save snyk to their test process, etc.
            prompts = prompts.concat(allPrompts.nextSteps(pkg, res.ok));
            if (prompts.length === 0) {
              return processAnswers({}, policy, options);
            }

            return interactive(prompts, policy, options);

          });
        });
      });
    });
  });
}

function interactive(prompts, policy, options) {
  return new Promise(function (resolve) {
    debug('starting questions');
    inquirer.prompt(prompts, function (answers) {
      resolve(processAnswers(answers, policy, options));
    });
  });
}

function processAnswers(answers, policy, options) {
  var cwd = process.cwd();
  var packageFile = path.resolve(cwd, 'package.json');

  if (!options) {
    options = {};
  }

  var tasks = {
    ignore: [],
    update: [],
    patch: [],
    skip: [],
  };

  var pkg = {};

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
    if (task === 'review') {
      task = 'skip';
    }

    if (task === 'ignore') {
      answer.meta.reason = answers[key + '-reason'];
      tasks[task].push(answer);
    } else {
      tasks[task].push(answer.vuln);
    }
  });

  debug(tasks);

  var live = !options['dry-run'];
  var promise = protect.generatePolicy(policy, tasks, live);
  var snykVersion = '*';

  var res = promise.then(function (policy) {
    if (!live) {
      // if this was a dry run, we'll throw an error to bail out of the
      // promise chain, then in the catch, check the error.code and if
      // it matches `DRYRUN` we'll return the text and not an error
      // (which avoids the exit code 1).
      var e = new Error('This was a dry run: nothing changed');
      e.code = 'DRYRUN';
      throw e;
    }

    return snyk.policy.save(policy);
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
    if (answers['misc-test-no-monitor']) { // allows us to automate tests
      return {
        id: 'test'
      };
    }

    debug('running monitor');
    var lbl = 'Remembering current dependencies for future ' +
      'notifications...';
    return snyk.modules(cwd)
      .then(spinner(lbl))
      .then(snyk.monitor.bind(null, {
        method: 'wizard',
      }))
      .then(spinner.clear(lbl));
  })
  .then(function (monitorRes) {
    var endpoint = url.parse(config.API);
    endpoint.pathname = '/monitor/' + monitorRes.id;

    return (options.newPolicy ?
      // if it's a newly created file
      '\nYour policy file has been created with the actions you\'ve ' +
        'selected, add it to your source control (`git add .snyk`).' :
      // otherwise we updated it
      '\nYour .snyk policy file has been successfully updated.') +
      '\nTo review your policy, run `snyk policy`.\n\n' +
      'You can see a snapshot of your dependencies here:\n' +
      url.format(endpoint) +
      '\n\nWe\'ll notify you when relevant new vulnerabilities are ' +
      'disclosed.';
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