module.exports = protect;

var Promise = require('es6-promise').Promise; // jshint ignore:line

var debug = require('debug')('snyk');
var snyk = require('../../lib/');
var protect = require('../../lib/protect');
var inquirer = require('inquirer');
var path = require('path');
var fs = require('then-fs');
var _ = require('lodash');

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

    // FIXME should patch
    if (config.patch) {
      return 'patch not available in beta';
    }
    return 'nothing to do';
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
        type: 'expand',
        message: 'Fix vulnerability in ' + from +
          '\n  - from: ' + vuln.from.join(' > '),
      };

      if (vuln.patches && vuln.patches.length) {
        // check that the version we have has a patch available
        var patches = protect.patchesForPackage({
          name: vuln.name,
          version: vuln.version,
        }, vuln);

        if (patches !== null) {
          debug('%s@%s', vuln.name, vuln.version, patches);
          choices.unshift(patch);
        }
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

      if (upgradeAvailable) {
        choices.unshift(update);
        update.name = 'Update to ' + vuln.upgradePath.filter(Boolean).shift();
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

    debug('starting questions');

    return new Promise(function (resolve) {
      inquirer.prompt(prompts, function (answers) {
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
        var packageFile = path.resolve(cwd, 'package.json');
        var promise = protect.generateConfig(config, tasks, live);

        promise.then(function (config) {
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
          debug('updating %s', packageFile);
          return fs.readFile(packageFile, 'utf8');
        })
        .then(function (src) {
          var data = JSON.parse(src);

          if (!data.scripts) {
            data.scripts = {};
          }

          data.scripts['snyk-protect'] = 'snyk protect';

          var cmd = 'npm run snyk-protect';
          if (data.scripts['post-install']) {
            // only add the post-install if it's not already in the post-install
            if (data.scripts['post-install'].indexOf(cmd) === -1) {
              data.scripts['post-install'] = cmd + ' && ' +
                data.scripts['post-install'];
            }
          } else {
            data.scripts['post-install'] = cmd;
          }

          data.snyk = true;

          return JSON.stringify(data, '', 2);
        })
        // .then(fs.writeFile.bind(null, packageFile)) // FIXME deferred
        .then(function () {
          // originally:
          // .snyk file saved and package.json updated with protect.
          return '.snyk file successfully saved.';
        })
        .catch(function (error) {
          if (error.code === 'DRYRUN') {
            return error.message;
          }

          throw error;
        });

        resolve(promise);
      });
    });

  });

}
