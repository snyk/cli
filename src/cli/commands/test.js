module.exports = test;

var _ = require('lodash');
var chalk = require('chalk');
var debug = require('debug')('snyk');
var snyk = require('../../lib/');
var config = require('../../lib/config');
var isCI = require('../../lib/is-ci');
var apiTokenExists = require('../../lib/api-token').exists;
var SEVERITIES = require('../../lib/snyk-test/common').SEVERITIES;
var WIZARD_SUPPORTED_PMS =
  require('../../lib/snyk-test/common').WIZARD_SUPPORTED_PMS;
var docker = require('../../lib/docker');
var SEPARATOR = '\n-------------------------------------------------------\n';

// arguments array is 0 or more `path` strings followed by
// an optional `option` object
function test() {
  var args = [].slice.call(arguments, 0);
  var options = {};
  var results = [];
  var resultOptions = [];

  if (typeof args[args.length - 1] === 'object') {
    options = args.pop();
  }

  // populate with default path (cwd) if no path given
  if (args.length ===  0) {
    args.unshift(process.cwd());
  }

  // org fallback to config unless specified
  options.org = options.org || config.org;
  // making `show-vulnerable-paths` true by default.
  options.showVulnPaths = (options['show-vulnerable-paths'] || '')
    .toLowerCase() !== 'false';

  if (options.severityThreshold
    && !validateSeverityThreshold(options.severityThreshold)) {
    return Promise.reject(new Error('INVALID_SEVERITY_THRESHOLD'));
  }

  return apiTokenExists('snyk test')
    .then(function () {
    // Promise waterfall to test all other paths sequentially
      var testsPromises = args.reduce(function (acc, path) {
        return acc.then(function () {
        // Create a copy of the options so a specific test can
        // modify them i.e. add `options.file` etc. We'll need
        // these options later.
          var testOpts = _.cloneDeep(options);
          testOpts.path = path;
          resultOptions.push(testOpts);

          // run the actual test
          return snyk.test(path, testOpts)
            .catch(function (error) {
              // Possible error cases:
              // - the test found some vulns. `error.message` is a
              // JSON-stringified
              //   test result.
              // - the flow failed, `error` is a real Error object.
              // - the flow failed, `error` is a number or string
              // describing the problem.
              //
              // To standardise this, make sure we use the best _object_ to
              // describe the error.
              if (error instanceof Error) {
                return error;
              }

              if (typeof error !== 'object') {
                return new Error(error);
              }

              try {
                return JSON.parse(error.message);
              } catch (unused) {
                return error;
              }
            })
            .then(function (res) {
              // add the tested path to the result of the test (or error)
              results.push(_.assign(res, {path: path}));
            });
        });
      }, Promise.resolve());

      return testsPromises;
    }).then(function () {
    // resultOptions is now an array of 1 or more options used for
    // the tests results is now an array of 1 or more test results
    // values depend on `options.json` value - string or object
      if (options.json) {
        results = results.map(function (result) {
        // add json for when thrown exception
          if (result instanceof Error) {
            return {
              ok: false,
              error: result.message,
              path: result.path,
            };
          }
          return result;
        });

        // backwards compat - strip array IFF only one result
        var dataToSend = results.length === 1 ? results[0] : results;
        var json = JSON.stringify(dataToSend, '', 2);

        if (results.every(function (res) {
          return res.ok;
        })) {
          return json;
        }

        throw new Error(json);
      }

      var response = results.map(function (unused, i) {
        return displayResult(results[i], resultOptions[i]);
      }).join('\n' + SEPARATOR);

      var vulnerableResults = results.filter(res => {
        return res.vulnerabilities && res.vulnerabilities.length;
      });
      var errorResults = results.filter(function (res) {
        return res instanceof Error;
      });

      if (errorResults.length > 0) {
        debug('Failed to test ' + errorResults.length + ' projects, errors:');
        errorResults.forEach(function (err) {
          var errString = err.stack ? err.stack.toString() : err.toString();
          debug('error: %s', errString);
        });
      }

      var summaryMessage = '';

      if (results.length > 1) {
        var projects = results.length === 1 ? ' project' : ' projects';
        summaryMessage = '\n\n' + '\nTested ' + results.length + projects +
        summariseVulnerableResults(vulnerableResults, options) +
        summariseErrorResults(errorResults) + '\n';
      }

      var notSuccess = vulnerableResults.length > 0 || errorResults.length > 0;

      if (notSuccess) {
        response += chalk.bold.red(summaryMessage);
        const error = new Error(response);
        // take the code of the first problem to go through error
        // translation
        // HACK as there can be different errors, and we pass only the
        // first one
        error.code = (vulnerableResults[0] || errorResults[0]).code;
        error.userMessage = (vulnerableResults[0] || errorResults[0]).userMessage;
        throw error;
      }

      response += chalk.bold.green(summaryMessage);
      return response;
    });
}

function summariseVulnerableResults(vulnerableResults, options) {
  var vulnsLength = vulnerableResults.length;
  if (vulnsLength) {
    if (options.showVulnPaths) {
      return ', ' + vulnsLength + ' contained vulnerable paths.';
    }
    return ', ' + vulnsLength + ' had issues.';
  }

  if (options.showVulnPaths) {
    return ', no vulnerable paths were found.';
  }

  return ', no issues were found.';
}

function summariseErrorResults(errorResults) {
  const projects =
    errorResults.length > 1 ? ' projects' :  ' project';
  if (errorResults.length > 0) {
    return ' Failed to test ' + errorResults.length + projects +
      '.\nRun with `-d` for debug output and contact support@snyk.io';
  }

  return '';
}

function displayResult(res, options) {
  var meta = metaForDisplay(res, options) + '\n\n';
  var dockerAdvice = dockerRemediationForDisplay(res);
  var packageManager = options.packageManager;
  var prefix = chalk.bold.white('\nTesting ' + options.path + '...\n\n');

  // handle errors by extracting their message
  if (res instanceof Error) {
    return prefix + res.message;
  }
  var issuesText = res.licensesPolicy ? 'issues' : 'vulnerabilities';
  var pathOrDepsText = '';

  if (res.hasOwnProperty('dependencyCount')) {
    pathOrDepsText += res.dependencyCount + ' dependencies';
  } else {
    pathOrDepsText += options.path;
  }
  var testedInfoText =
    'Tested ' + pathOrDepsText + ' for known ' + issuesText;

  let dockerSuggestion = '';
  if (docker.shouldSuggestDocker(options)) {
    dockerSuggestion += chalk.bold.white(docker.suggestionText);
  }

  // OK  => no vulns found, return
  if (res.ok && res.vulnerabilities.length === 0) {
    var vulnPathsText = options.showVulnPaths ?
      ', no vulnerable paths found.' :
      ', none were found.';
    var summaryOKText = chalk.green(
      '✓ ' + testedInfoText + vulnPathsText
    );
    var nextStepsText =
        '\n\nNext steps:' +
        '\n- Run `snyk monitor` to be notified ' +
        'about new related vulnerabilities.' +
        '\n- Run `snyk test` as part of ' +
        'your CI/test.';
    return (
      prefix + meta + summaryOKText + (isCI ? '' : dockerAdvice + nextStepsText + dockerSuggestion)
    );
  }

  // NOT OK => We found some vulns, let's format the vulns info
  var vulnCount = res.vulnerabilities && res.vulnerabilities.length;
  var singleVulnText = res.licensesPolicy ? 'issue' : 'vulnerability';
  var multipleVulnsText = res.licensesPolicy ? 'issues' : 'vulnerabilities';

  // Text will look like so:
  // 'found 232 vulnerabilities, 404 vulnerable paths.'
  var vulnCountText = 'found ' + res.uniqueCount + ' '
    + (res.uniqueCount === 1 ? singleVulnText : multipleVulnsText);

  // Docker is currently not supported as num of paths is inaccurate due to trimming of paths to reduce size.
  if (options.showVulnPaths && !options.docker) {
    vulnCountText += ', ' + vulnCount + ' vulnerable ';

    if (vulnCount === 1) {
      vulnCountText += 'path.';
    } else {
      vulnCountText += 'paths.';
    }
  } else {
    vulnCountText += '.';
  }
  var summary = testedInfoText + ', ' + chalk.red.bold(vulnCountText);

  if (WIZARD_SUPPORTED_PMS.indexOf(packageManager) > -1) {
    summary += chalk.bold.green(
      '\n\nRun `snyk wizard` to address these issues.'
    );
  }

  if (options.docker &&
      !options.file &&
      (!config.disableSuggestions || config.disableSuggestions !== 'true')) {
    summary += chalk.bold.white('\n\n Pro tip: use `--file` option to get base image remediation advice.' +
    `\n Example: $ snyk test --docker ${options.path} --file=path/to/Dockerfile` +
    '\n\nTo remove this message in the future, please run `snyk config set disableSuggestions=true`');
  }

  var vulns = res.vulnerabilities || [];
  var groupedVulns = groupVulnerabilities(vulns);
  var sortedGroupedVulns = _.orderBy(
    groupedVulns,
    ['metadata.severityValue', 'metadata.name'],
    ['asc', 'desc']
  );
  var groupedVulnInfoOutput = sortedGroupedVulns.map(function (vuln) {
    var vulnID = vuln.list[0].id;
    var uniquePackages = _.uniq(
      vuln.list.map(function (i) {
        if (i.from[1]) {
          return i.from && i.from[1];
        }
        return i.from;
      }))
      .join(', ');
    var vulnOutput = {
      issueHeading: createSeverityBasedIssueHeading(
        vuln.metadata.severity,
        vuln.metadata.type,
        vuln.metadata.name
      ),
      introducedThrough: '  Introduced through: ' + uniquePackages,
      description: '  Description: ' + vuln.title,
      info: '  Info: ' + chalk.underline(config.ROOT + '/vuln/' + vulnID),
      fromPaths: options.showVulnPaths
        ? createTruncatedVulnsPathsText(vuln.list) : '',
      extraInfo: vuln.note ? chalk.bold('\n  Note: ' + vuln.note) : '',
      remediationInfo: vuln.metadata.type !== 'license'
        ? createRemediationText(vuln, packageManager)
        : '',
      fixedIn: options.docker ? createFixedInText(vuln) : '',
    };
    return (
      vulnOutput.issueHeading + '\n' +
      vulnOutput.description + '\n' +
      vulnOutput.info + '\n' +
      vulnOutput.introducedThrough + '\n' +
      vulnOutput.fromPaths +
      // Optional - not always there
      vulnOutput.remediationInfo +
      vulnOutput.fixedIn +
      vulnOutput.extraInfo
    );
  });

  var body = groupedVulnInfoOutput.join('\n\n') + '\n\n' + meta + summary;
  return prefix + body + dockerAdvice;
}

function createFixedInText(groupedVuln) {
  var vulnerableRange = groupedVuln.list[0].semver.vulnerable[0];
  if (/^<\S+$/.test(vulnerableRange)) {
    // removing the first char from the version. For example: <7.50.1-1
    return chalk.bold('\n  Fixed in: ' + vulnerableRange.substr(1));
  }
  return '';
}

function createRemediationText(vuln, packageManager) {
  var packageName = vuln.metadata.name;
  var wizardHintText = '';
  if (WIZARD_SUPPORTED_PMS.indexOf(packageManager) > -1) {
    wizardHintText = 'Run `snyk wizard` to explore remediation options.';
  }

  if (vuln.isOutdated === true) {
    var packageManagerOutdatedText = {
      npm: '\n    Try deleting node_modules, reinstalling ' +
      'and running `snyk test` again. If the problem persists, ' +
      'one of your dependencies may be bundling outdated modules.',
      rubygems: '\n    Try running `bundle update ' + packageName + '` ' +
      'and running `snyk test` again.',
      yarn: '\n    Try deleting node_modules, reinstalling ' +
      'and running `snyk test` again. If the problem persists, ' +
      'one of your dependencies may be bundling outdated modules.',
    };

    return chalk.bold(
      '\n  Remediation:\n    Your dependencies are out of date, ' +
      'otherwise you would be using a newer version of ' +
      packageName + '. ' +
      _.get(packageManagerOutdatedText, packageManager, ''));
  }

  if (vuln.isFixable === true) {
    var upgradePathsArray = _.uniq(vuln.list.map(function (v) {
      var shouldUpgradeItself = !!v.upgradePath[0];
      var shouldUpgradeDirectDep = !!v.upgradePath[1];

      if (shouldUpgradeItself) {
        // If we are testing a library/package like express
        // Then we can suggest they get the latest version
        // Example command: snyk test express@3
        var selfUpgradeInfo = (v.upgradePath.length > 0)
          ? ' (triggers upgrades to ' + v.upgradePath.join(' > ') + ')'
          : '';
        var testedPackageName = v.upgradePath[0].split('@');
        return 'You\'ve tested an outdated version of ' +
          testedPackageName[0] + '. Upgrade to ' +
          v.upgradePath[0] + selfUpgradeInfo;
      }
      if (shouldUpgradeDirectDep) {
        var formattedUpgradePath = v.upgradePath.slice(1).join(' > ');
        var upgradeTextInfo = (v.upgradePath.length)
          ? ' (triggers upgrades to ' + formattedUpgradePath + ')'
          : '';

        return 'Upgrade direct dependency ' + v.from[1] + ' to ' +
          v.upgradePath[1] + upgradeTextInfo;
      }

      return 'Some paths have no direct dependency upgrade that' +
        ' can address this issue. ' + wizardHintText;
    }));
    return chalk.bold('\n  Remediation: \n    ' +
      upgradePathsArray.join('\n    '));
  }

  return '';
}

function createSeverityBasedIssueHeading(severity, type, packageName, isNew) {
  // Example: ✗ Medium severity vulnerability found in xmldom
  var vulnTypeText = type === 'license' ? 'issue' : 'vulnerability';
  var severitiesColourMapping = {
    low: {
      colorFunc: function (text) {
        return chalk.bold.blue(text);
      },
    },
    medium: {
      colorFunc: function (text) {
        return chalk.bold.yellow(text);
      },
    },
    high: {
      colorFunc: function (text) {
        return chalk.bold.red(text);
      },
    },
  };
  return severitiesColourMapping[severity].colorFunc(
    '✗ ' + titleCaseText(severity) + ' severity ' + vulnTypeText
    + ' found in ' + chalk.underline(packageName)) +
    chalk.bold.magenta(isNew ? ' (new)' : '');
}

function createTruncatedVulnsPathsText(vulnList) {
  var numberOfPathsToDisplay = 3;
  var fromPathsArray = vulnList.map(function (i) {
    return i.from;
  });

  var formatedFromPathsArray = fromPathsArray.map(function (i) {
    var fromWithoutBaseProject = i.slice(1);
    // If more than one From path
    if (fromWithoutBaseProject.length) {
      return i.slice(1).join(' > ');
    }
    // Else issue is in the core package
    return i;
  });

  var notShownPathsNumber = fromPathsArray.length - numberOfPathsToDisplay;
  var shouldTruncatePaths = fromPathsArray.length > 3;
  var truncatedText = '\n  and ' + notShownPathsNumber + ' more...';
  var formattedPathsText = formatedFromPathsArray
    .slice(0, numberOfPathsToDisplay)
    .join('\n  From: ');

  if (fromPathsArray.length > 0) {
    return '  From: ' + formattedPathsText +
      (shouldTruncatePaths ? truncatedText : '');
  }
}

function rightPadWithSpaces(s, desiredLength) {
  var padLength = desiredLength - s.length;
  if (padLength <= 0) {
    return s;
  }

  return s + ' '.repeat(padLength);
}

function metaForDisplay(res, options) {
  var padToLength = 19; // chars to align
  var packageManager = options.packageManager || res.packageManager;
  var openSource = res.isPrivate ? 'no' : 'yes';
  var meta = [
    chalk.bold(rightPadWithSpaces('Organisation: ', padToLength)) + res.org,
    chalk.bold(rightPadWithSpaces('Package manager: ', padToLength)) + packageManager,
  ];
  if (options.file) {
    meta.push(chalk.bold(rightPadWithSpaces('Target file: ', padToLength)) + options.file);
  }
  if (options.docker) {
    meta.push(chalk.bold(rightPadWithSpaces('Docker image: ', padToLength)) + options.path);
  } else {
    meta.push(chalk.bold(rightPadWithSpaces('Open source: ', padToLength)) + openSource);
    meta.push(chalk.bold(rightPadWithSpaces('Project path: ', padToLength)) + options.path);
  }
  if (res.docker && res.docker.baseImage) {
    meta.push(chalk.bold(rightPadWithSpaces('Base image: ', padToLength)) + res.docker.baseImage);
  }

  if (res.filesystemPolicy) {
    meta.push(chalk.bold(rightPadWithSpaces('Local Snyk policy: ', padToLength)) + chalk.green('found'));
    if (res.ignoreSettings && res.ignoreSettings.disregardFilesystemIgnores) {
      meta.push(chalk.bold(rightPadWithSpaces('Local Snyk policy ignored: ', padToLength)) + chalk.red('yes'));
    }
  }
  if (res.licensesPolicy) {
    meta.push(chalk.bold(rightPadWithSpaces('Licenses: ', padToLength)) + chalk.green('enabled'));
  }

  return meta.join('\n');
}

function dockerRemediationForDisplay(res) {
  if (!res.docker || !res.docker.baseImageRemediation) {
    return '';
  }
  const {advice, message} = res.docker.baseImageRemediation;
  const out = [];

  if (advice) {
    for (const item of advice) {
      out.push(item.bold ? chalk.bold(item.message) : item.message);
    }
  } else if (message) {
    out.push(message);
  } else {
    return '';
  }

  return '\n\n' + out.join('\n');
}

function validateSeverityThreshold(severityThreshold) {
  return SEVERITIES
    .map(function (s) {
      return s.verboseName;
    })
    .indexOf(severityThreshold) > -1;
}

function getSeverityValue(severity) {
  return SEVERITIES.find(function (severityObj) {
    if (severityObj['verboseName'] === severity) {
      return severityObj;
    }
  }).value;
}

function titleCaseText(text) {
  return text[0].toUpperCase() + text.slice(1) ;
}

// This is all a copy from Registry snapshots/index
function isVulnFixable(vuln) {
  return (vuln.isUpgradable || vuln.isPatchable) && !vuln.isOutdated;
}

function groupVulnerabilities(vulns) {
  return vulns.reduce(function (map, curr) {
    if (!map[curr.id]) {
      map[curr.id] = {};
      map[curr.id].list = [];
      map[curr.id].metadata = metadataForVuln(curr);
      map[curr.id].isIgnored = false;
      map[curr.id].isPatched = false;
      // Extra added fields for ease of handling
      map[curr.id].title = curr.title;
      map[curr.id].note = curr.note;
      map[curr.id].severity = curr.severity;
      map[curr.id].isNew = isNewVuln(curr);
    }
    if (curr.upgradePath) {
      curr.isOutdated = curr.upgradePath[1] === curr.from[1];
    }
    map[curr.id].list.push(curr);
    if (!map[curr.id].isFixable) {
      map[curr.id].isFixable = isVulnFixable(curr);
    }

    if (!map[curr.id].isOutdated) {
      map[curr.id].isOutdated = !!curr.isOutdated ;
    }

    if (!map[curr.id].note) {
      map[curr.id].note = !!curr.note ;
    }

    return map;
  }, {});
}
// check if vuln was published in the last month
function isNewVuln(vuln) {
  var MONTH = 30 * 24 * 60 * 60 * 1000;
  return new Date(vuln.publicationTime) > Date.now() - MONTH;
}

function metadataForVuln(vuln) {
  return {
    id: vuln.id,
    title: vuln.title,
    description: vuln.description,
    type: vuln.type,
    name: vuln.name,
    info: vuln.info,
    severity: vuln.severity,
    severityValue: getSeverityValue(vuln.severity),
    isNew: isNewVuln(vuln),
  };
}
