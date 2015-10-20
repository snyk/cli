module.exports = test;

var snyk = require('../../');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var config = require('../../lib/config');

function test(path, options) {
  var args = [].slice.call(arguments, 0);

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
        res = '\nTesting ' + path + '...\n' + res;
        return res;
      });
    });

    return Promise.all(promises).then(function (res) {
      var projects = testedProjects === 1 ? ' project' : ' projects';
      res += '\nTested ' + testedProjects + projects;

      if (shouldThrow > 0) {
        res += ', ' + shouldThrow + ' contained vulnerabilities.';
        throw new Error(res);
      } else {
        res += ', no vulnerabilities were found.';
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

  return snyk.test(path || process.cwd()).then(function (res) {
    if (options.json) {
      return JSON.stringify(res, '', 2);
    }

    var msg = 'Tested ';
    if (res.hasOwnProperty('dependencyCount')) {
      msg += res.dependencyCount + ' dependencies';
    } else {
      msg += path;
    }
    msg += ' for known vulnerabilities';

    if (res.ok) {
      msg = '✓ ' + msg + ', no vulnerabilities found.';
      return msg;
    }

    msg = msg + ', found ' + res.vulnerabilities.length;
    if (res.vulnerabilities.length === 1) {
      msg += ' vulnerability.\n\n';
    } else {
      msg += ' vulnerabilities.\n\n';
    }

    var error = new Error(msg + res.vulnerabilities.map(function (vuln) {
      var name = vuln.name + '@' + vuln.version;
      var res = '✗ vulnerability found on ' + name + '\n';

      res += 'From: ' + vuln.from.join(' > ') + '\n';
      res += 'Info: ' + config.ROOT + '/vuln/' + vuln.id;
      res += '\n';

      var upgradeSteps = (vuln.upgradePath || []).filter(Boolean);

      // Remediation instructions (if we have one)
      if (upgradeSteps.length) {

        // Create upgrade text
        var upgradeText = upgradeSteps.shift();
        upgradeText += (upgradeSteps.length)?
           ' (triggers upgrades to ' + upgradeSteps.join(' > ') + ')':'';

        res += 'Fix : ';
        for (var idx = 0; idx < vuln.upgradePath.length; idx++) {
          var elem = vuln.upgradePath[idx];

          if (elem) {
            // Check if we're suggesting to upgrade to ourselves.
            if (vuln.from.length > idx && vuln.from[idx] === elem) {
              // This ver should get the not-vuln dependency, suggest refresh
              res +=
               'Your dependencies are out of date. ' +
               'Delete node_modules & reinstall to upgrade to ' + upgradeText +
               '.\n If you\'re using a private repsository, ' +
                'ensure it\'s up to date.';
              break;
            }
            if (idx === 0) {
              // This is an outdated version of yourself
              res += 'You\'ve tested an outdated version of the project. ' +
                'Should be upgraded to ' + upgradeText;
            } else if (idx === 1) {
              // A direct dependency needs upgrade. Nothing to add.
              res += 'Upgrade direct dependency ' + vuln.from[idx] +
                ' to ' + upgradeText;
            } else {
              // A deep dependency needs to be upgraded
              res += 'No direct dependency upgrade can address this issue.\n' +
                'Run snyk protect -i to apply a patch or manually upgrade ' +
                'deep dependency\n' + vuln.from[idx] + ' to ' + upgradeText;
            }
            break;
          }
        }
      } else {
        res += 'Fix: None available. Consider removing this dependency.';
      }
      return res;
    }).join('\n-----\n'));

    error.code = 'VULNS';
    throw error;
  });
}
