var snyk = require('../../');
var chalk = require('chalk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var config = require('../../lib/config');

module.exports = function (path, options) {
  if (path && typeof path !== 'string') {
    options = path;
    path = false;
  }

  if (!options) {
    options = {};
  }

  return snyk.test(path || process.cwd()).then(function (res) {
    if (options.json) {
      var json = JSON.stringify(res, '', 2);
      if (res.ok) {
        return json;
      } else {
        throw new Error(json);
      }
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
      return summary;
    }

    var vulnLength = res.vulnerabilities.length;
    summary = summary + ', ' + chalk.red.bold('found ' + vulnLength);
    if (res.vulnerabilities.length === 1) {
      summary += chalk.red.bold(' vulnerability.');
    } else {
      summary += chalk.red.bold(' vulnerabilities.');
    }

    var sep = '\n\n'; //  ──────────────────\n

    throw new Error(res.vulnerabilities.map(function (vuln) {
      var res = '';

      var name = vuln.name + '@' + vuln.version;
      res += chalk.red('✗ Vulnerability found on ' + name + '\n');
      res += 'Info: ' + config.ROOT + '/vuln/' + vuln.id + '\n\n';

      res += 'From: ' + vuln.from.join(' > ') + '\n';

      var upgradeSteps = (vuln.upgradePath || []).filter(Boolean);

      // Remediation instructions (if we have one)
      if (upgradeSteps.length) {

        // Create upgrade text
        var upgradeText = upgradeSteps.shift();
        upgradeText += (upgradeSteps.length)?
           '\nTriggers upgrades to ' + upgradeSteps.join(' > ') : '';

        var fix = ''; // = 'Fix:\n';
        for (var idx = 0; idx < vuln.upgradePath.length; idx++) {
          var elem = vuln.upgradePath[idx];

          if (elem) {
            // Check if we're suggesting to upgrade to ourselves.
            if (vuln.from.length > idx && vuln.from[idx] === elem) {
              // This ver should get the not-vuln dependency, suggest refresh
              fix +=
               'Your dependencies are out of date.\n' +
               'Delete node_modules & reinstall to upgrade to ' + upgradeText +
               '.\nIf you\'re using a private repsository, ' +
                'ensure it\'s up to date.';
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
              fix += 'Manually upgrade deep dependency ' + vuln.from[idx] +
                ' to ' + upgradeText;
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
  });
};
