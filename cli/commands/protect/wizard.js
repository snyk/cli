module.exports = wizard;

var Promise = require('es6-promise').Promise; // jshint ignore:line

var debug = require('debug')('snyk');
var isAuthed = require('../auth').isAuthed;
var getVersion = require('../version');
var inquirer = require('inquirer');
var path = require('path');
var fs = require('then-fs');
var getPrompts = require('./prompts').getPrompts;
var nextSteps = require('./prompts').nextSteps;
var snyk = require('../../../lib/');

function wizard(options) {
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
    if (error.code === 'ENOENT') {
      options.newDotFile = true;
      return {};
    }

    throw error;
  }).then(function (config) {
    return isAuthed().then(function (authed) {
      if (!authed) {
        throw new Error('Unauthorized');
      }

      snyk.modules(process.cwd()).then(snyk.monitor.bind(null, {
        method: 'protect',
      }));

      var cwd = process.cwd();
      return snyk.test(cwd).then(function (res) {
        if (res.ok) {
          return 'Nothing to be done. Well done, you.';
        }

        return interactive(res.vulnerabilities, config, options);
      });
    });
  });
}


function interactive(vulns, config, options) {
  var cwd = process.cwd();
  var prompts = getPrompts(vulns);
  var packageFile = path.resolve(cwd, 'package.json');

  return fs.readFile(packageFile, 'utf8').then(JSON.parse).then(function (pkg) {
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
}

