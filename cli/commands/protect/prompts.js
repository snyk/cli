module.exports = {
  getPrompts: getPrompts,
  nextSteps: nextSteps,
};

var _ = require('lodash');
var debug = require('debug')('snyk');
var protect = require('../../../lib/protect');
var undefsafe = require('undefsafe');
var config = require('../../../lib/config');

function getPrompts(vulns) {
  if (!vulns) {
    vulns = []; // being defensive, but maybe we should throw an error?
  }

  var skipAction = {
    value: 'skip', // the value that we get in our callback
    key: 's',
    name: 'Skip', // the text the user sees
  };

  var ignoreAction = {
    value: 'ignore',
    key: 'i',
    meta: { // arbitrary data that we'll merged into the `value` later on
      days: 30,
    },
    name: 'Set to ignore for 30 days',
  };

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

  var prompts = vulns.map(function (vuln, i) {
    var id = vuln.id || ('node-' + vuln.name + '@' + vuln.below);

    id += '-' + i;

    // make complete copies of the actions, otherwise we'll mutate the object
    var ignore = _.cloneDeep(ignoreAction);
    var skip = _.cloneDeep(skipAction);
    var patch = _.cloneDeep(patchAction);
    var update = _.cloneDeep(updateAction);

    var choices = [];

    var from = vuln.from.slice(1).filter(Boolean).shift();
    var severity = vuln.severity[0].toUpperCase() + vuln.severity.slice(1);
    var res = {
      name: id,
      type: 'list',
      message: severity + ' severity vulnerability found in ' + from +
        '\n  - info: ' + config.ROOT + '/vuln/' + vuln.id +
        '\n  - from: ' + vuln.from.join(' > ')
    };

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
      choices.push(update);
      update.name = 'Upgrade to ' + vuln.upgradePath.filter(Boolean).shift();
    } else {
      // No upgrade available (as per no patch)
      choices.push({
        value: 'skip',
        key: 'u',
        name: 'Upgrade (no sufficient ' + vuln.name + ' upgrade available, ' +
          'we\'ll notify you when there is one)',
      });
    }


    var patches = null;
    if (vuln.patches && vuln.patches.length) {
      // check that the version we have has a patch available
      patches = protect.patchesForPackage({
        name: vuln.name,
        version: vuln.version,
      }, vuln);

      if (patches !== null) {
        debug('%s@%s', vuln.name, vuln.version, patches);
        if (!upgradeAvailable) {
          patch.default = true;
        }
        choices.push(patch);
      }
    }

    if (patches === null) {
      // add a disabled option saying that patch isn't available
      // note that adding `disabled: true` does nothing, so the user can
      // actually select this option. I'm not 100% it's the right thing,
      // but we'll keep a keen eye on user feedback.
      choices.push({
        value: 'skip',
        key: 'p',
        name: 'Patch (no patch available, we\'ll notify you when there is one)',
      });
    }

    if (patches === null && !upgradeAvailable) {
      ignore.default = true;
    }

    choices.push(ignore);
    choices.push(skip);

    res.default = (choices.map(function (choice, i) {
      return { i: i, default: choice.default };
    }).filter(function (choice) {
      return choice.default;
    }).shift() || { i: 0 }).i;

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

  return prompts;
}

function nextSteps(pkg) {
  var i;
  var prompts = [];

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