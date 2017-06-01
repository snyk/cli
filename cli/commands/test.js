module.exports = test;

var snyk = require('../../');
var chalk = require('chalk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var config = require('../../lib/config');
var isCI = require('../../lib/is-ci');
var apiTokenExists = require('../../lib/api-token').exists;

function test(path, options) {
  path = path || process.cwd();
  options = options || {};
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

  if (config.org) {
    options.org = config.org;
  }

  // making `show-vulnerable-paths` true by default.
  var showVulnPaths = (options['show-vulnerable-paths'] || '')
        .toLowerCase() !== 'false';

  return apiTokenExists('snyk test')
  .then(function () {
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
        var paths = shouldThrow === 1 ? 'path' : 'paths';
        var testedMessage = '\n\nTested ' + testedProjects + projects;

        if (shouldThrow > 0) {
          if (showVulnPaths) {
            testedMessage +=  ', ' + shouldThrow + ' contained vulnerable ' +
              paths;
          }
          testedMessage += '.';
          res += chalk.bold.red(testedMessage);
          throw new Error(res);
        } else {
          if (showVulnPaths) {
            testedMessage += ', no vulnerable paths were found.';
          } else {
            testedMessage += ', no issues were found.';
          }
          res += chalk.green(testedMessage);
        }

        return res;
      });
    }

    if (path && typeof path !== 'string') {
      options = path;
      path = false;
    }

    return snyk.test(path || process.cwd(), options);
  }).then(function (res) {
    var packageManager = res.packageManager;
    if (options.json) {
      var json = JSON.stringify(res, '', 2);
      if (res.ok) {
        return json;
      }

      throw new Error(json);
    }

    var summary = 'Tested ';
    if (res.hasOwnProperty('dependencyCount')) {
      summary += res.dependencyCount + ' dependencies';
    } else {
      summary += path;
    }
    var issues = res.licensesPolicy ? 'issues' : 'vulnerabilities';
    summary += ' for known ' + issues;

    if (res.ok && res.vulnerabilities.length === 0) {
      var vulnPaths = showVulnPaths ?
            ', no vulnerable paths found.' :
            ', none were found.';
      summary = chalk.green('✓ ' + summary + vulnPaths);

      if (!isCI) {
        summary += '\n\nNext steps:\n- Run `snyk monitor` to be notified ' +
          'about new related vulnerabilities.\n- Run `snyk test` as part of ' +
          'your CI/test.';
      }
      return summary;
    }

    var vulnLength = res.vulnerabilities.length;
    var count = 'found ' + res.uniqueCount;
    if (res.uniqueCount === 1) {
      var issue = res.licensesPolicy ? 'issue' : 'vulnerability';
      count += ' ' + issue + ', ';
    } else {
      count += ' ' + (res.licensesPolicy ? 'issues' : 'vulnerabilities') + ', ';
    }
    if (showVulnPaths) {
      count += vulnLength + ' vulnerable ';

      if (res.vulnerabilities.length === 1) {
        count += 'path.';
      } else {
        count += 'paths.';
      }
    } else {
      count = count.slice(0, -2) + '.'; // replace ', ' with dot
    }
    summary = summary + ', ' + chalk.red.bold(count);

    if (packageManager === 'npm' || packageManager === 'yarn') {
      summary += '\n\nRun `snyk wizard` to address these issues.';
    }

    var sep = '\n\n';

    var reportedVulns = {};
    var body = res.vulnerabilities.map(function (vuln) {
      if (!showVulnPaths && reportedVulns[vuln.id]) { return; }
      reportedVulns[vuln.id] = true;

      var res = '';
      var name = vuln.name + '@' + vuln.version;
      var severity = vuln.severity[0].toUpperCase() + vuln.severity.slice(1);
      var issue = vuln.type === 'license' ? 'issue' : 'vulnerability';
      res += chalk.red('✗ ' + severity + ' severity ' + issue + ' found on ' +
        name + '\n');
      res += '- desc: ' + vuln.title + '\n';
      res += '- info: ' + config.ROOT + '/vuln/' + vuln.id + '\n';
      if (showVulnPaths) {
        res += '- from: ' + vuln.from.join(' > ') + '\n';
      }

      if (vuln.note) {
        res += vuln.note + '\n';
      }

      // none of the output past this point is relevant if we're not displaying
      // vulnerable paths
      if (!showVulnPaths) {
        return res.trim();
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
                vuln.version + '.\n';
              if (packageManager === 'npm') {
                fix += 'Try deleting node_modules, reinstalling ' +
                'and running `snyk test` again.\nIf the problem persists, ' +
                'one of your dependencies may be bundling outdated modules.';
              } else if (packageManager === 'rubygems') {
                fix += 'Try running `bundle update ' + vuln.name + '` ' +
                'and running `snyk test` again.';
              }
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
        if (vuln.type === 'license') {
          // do not display fix (there isn't any), remove newline
          res = res.slice(0, -1);
        } else if (packageManager === 'npm') {
          res += chalk.magenta(
            'Fix: None available. Consider removing this dependency.');
        }
      }
      return res;
    }).filter(Boolean).join(sep) + sep + summary;

    if (res.ok) {
      return body;
    }

    var error = new Error(body);

    error.code = 'VULNS';
    throw error;
  });
}
