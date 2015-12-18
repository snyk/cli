module.exports = test;

var snyk = require('../../');
var chalk = require('chalk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var config = require('../../lib/config');

function test(path, options) {
  var args = [].slice.call(arguments, 0);

  if (typeof path === 'object') {
    options = path;
  }

  // if there's two strings on the arguments, it means we're doing multiple
  // projects, but the options has been omitted, so let's do an argument dance
  // to get some dummy opts in there
  if (args.length === 2 && typeof args[1] === 'string') {
    args.push({});
  }

  // if we have more than path, options, we're going to assume that we've
  // got multiple paths, i.e. test(path1, path2..., options)
  if (args.length > 2) {
    options = args.pop();

    var shouldThrow = 0;
    var testedProjects = 0;
    var promises = args.map(function (path) {
      return test(path, options).then(function (res) {
        testedProjects++;
        return res;
      }).catch(function (error) {
        // don't blow up our entire promise chain - but track that we should
        // throw the entire thing as an exception later on
        if (error.code === 'VULNS') {
          testedProjects++;
          shouldThrow++;
        }

        return error.message;
      }).then(function (res) {
        res = chalk.bold('\n\nTesting ' + path + '...\n') + res;
        return res;
      });
    });

    return Promise.all(promises).then(function (res) {
      res = res.join('');
      var projects = testedProjects === 1 ? ' project' : ' projects';

      if (shouldThrow > 0) {
        res += chalk.bold.red('\n\nTested ' + testedProjects + projects +
          ', ' + shouldThrow + ' contained vulnerabilities.');
        throw new Error(res);
      } else {
        res += chalk.green('\n\nTested ' + testedProjects + projects +
          ', no vulnerabilities were found.');
      }

      return res;
    });
  }

  if (path && typeof path !== 'string') {
    options = path;
    path = false;
  }

  if (!options) {
    options = {};
  }

  return snyk.test(path || process.cwd(), options).then(function (res) {
    if (options.json) {
      var json = JSON.stringify(res, '', 2);
      if (res.ok) {
        return json;
      }

      throw new Error(json);
    }

    var summary = 'Tested ';
    if (res.dependencyCount) {
      summary += res.dependencyCount + ' dependencies';
    }

    var msg = 'Tested ';
    if (res.hasOwnProperty('dependencyCount')) {
      msg += res.dependencyCount + ' dependencies';
    } else {
      summary += path;
    }
    summary += ' for known vulnerabilities';

    if (res.ok) {
      summary = chalk.green('✓ ' + summary + ', no vulnerabilities found.');

      summary += '\n\nNext steps:\n- Run `snyk monitor` to be notified about' +
        ' new related vulnerabilities.\n- Run `snyk test` as part of your ' +
        'CI/test.';
      return summary;
    }

    var vulnLength = res.vulnerabilities.length;
    summary = summary + ', ' + chalk.red.bold('found ' + vulnLength);
    if (res.vulnerabilities.length === 1) {
      summary += chalk.red.bold(' vulnerability.');
    } else {
      summary += chalk.red.bold(' vulnerabilities.');
    }

    var sep = '\n\n';

    var error = new Error(res.vulnerabilities.map(function (vuln) {
      var res = '';
      var name = vuln.name + '@' + vuln.version;
      res += chalk.red('✗ Vulnerability found on ' + name + '\n');
      res += 'Info: ' + config.ROOT + '/vuln/' + vuln.id + '\n';
      res += 'From: ' + vuln.from.join(' > ') + '\n';

      if (vuln.note) {
        res += vuln.note + '\n';
      }

      var upgradeSteps = (vuln.upgradePath || []).filter(Boolean);

      // Remediation instructions (if we have one)
      if (upgradeSteps.length) {

        // Create upgrade text
        var upgradeText = upgradeSteps.shift();
        upgradeText += (upgradeSteps.length) ?
           ' (triggers upgrades to ' + upgradeSteps.join(' > ') + ')' : '';

        var fix = ''; // = 'Fix:\n';
        for (var idx = 0; idx < vuln.upgradePath.length; idx++) {
          var elem = vuln.upgradePath[idx];

          if (elem) {
            // Check if we're suggesting to upgrade to ourselves.
            if (vuln.from.length > idx && vuln.from[idx] === elem) {
              // This ver should get the not-vuln dependency, suggest refresh
              fix += 'Your dependencies are out of date, otherwise you would ' +
                'be using a newer ' + vuln.name + ' than ' + vuln.name + '@' +
                vuln.version + '.\nTry deleting node_modules, reinstalling ' +
                'and running `snyk test` again.\nIf the problem persists, one' +
                ' of your dependencies may be bundling outdated modules.';
              break;
            }
            if (idx === 0) {
              // This is an outdated version of yourself
              fix += 'You\'ve tested an outdated version of the project. ' +
                'Should be upgraded to ' + upgradeText;
            } else if (idx === 1) {
              // A direct dependency needs upgrade. Nothing to add.
              fix += 'Upgrade direct dependency ' + vuln.from[idx] +
                ' to ' + upgradeText;
            } else {
              // A deep dependency needs to be upgraded
              res += 'No direct dependency upgrade can address this issue.\n' +
                chalk.bold('Run `snyk wizard` to explore remediation options.');
            }
            break;
          }

        }
        res += chalk.bold(fix);
      } else {
        res += chalk.magenta('Fix: None available. Consider removing this' +
        ' dependency.');
      }
      return res;
    }).join(sep) + sep + summary);

    error.code = 'VULNS';
    throw error;
  });
}
