module.exports = protect;

var Promise = require('es6-promise').Promise; // jshint ignore:line

var debug = require('debug')('snyk');
var snyk = require('../../lib/');
var protect = require('../../lib/protect');
var inquirer = require('inquirer');
var _ = require('lodash');

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
    var actions = [{
      value: 'skip',
      key: 's',
      name: 'skip it',
    }, {
      value: 'ignore',
      key: 'i',
      name: 'ignore it for 30 days',
    }, ];

    var patchAction = {
      value: 'patch',
      key: 'p',
      name: 'patch',
    };

    var updateAction = {
      value: 'update',
      key: 'u',
      name: 'update',
    };

    var prompts = res.vulnerabilities.map(function (vuln, i) {
      var id = vuln.id || ('node-' + vuln.name + '@' + vuln.below);

      id += '-' + i;

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


      var actionAdded = vuln.upgradePath.some(function (pkg, i) {
        // if the upgade path is to upgrade the module to the same range the
        // user already asked for, then it means we need to just blow that
        // module away and re-install
        if (pkg && vuln.from.length > i && pkg === vuln.from[i]) {
          choices.unshift(update);
          return true;
        }

        // if the upgradePath contains the first two elements, that is
        // the project itself (i.e. jsbin) then the direct dependency can be
        // upgraded. Note that if the first two elements
        if (vuln.upgradePath.slice(0, 2).filter(Boolean).length) {
          choices.unshift(update);
          return true;
        }
      });

      if (!actionAdded) {
        choices.unshift(patch);
      } else {
        update.name = 'Update to ' + vuln.upgradePath.filter(Boolean).shift();
      }

      // kludge to make sure that we get the vuln in the user selection
      res.choices = choices.map(function (choice) {
        var value = choice.value;
        choice.value = {
          vuln: vuln,
          choice: value,
        };
        return choice;
      });

      return res;
    });

    debug('starting questions');

    return new Promise(function (resolve) {
      inquirer.prompt(prompts, function (answers) {
        debug(JSON.stringify(answers, '', 2));

        // split the choices into:
        // update
        // ignore
        // patch
        // note that "skip" is left alone

        var tasks = {
          ignore: [],
          update: [],
          patch: [],
          skip: [],
        };

        Object.keys(answers).forEach(function (key) {
          var answer = answers[key];
          var task = answer.choice;

          tasks[task].push(answer.vuln);
        });

        var promises = [
          protect.ignore(tasks.ignore),
          protect.update(tasks.update, !options['dry-run']),
          protect.patch(tasks.patch, !options['dry-run']),
        ];

        resolve(Promise.all(promises));
      });
    });

  });

}