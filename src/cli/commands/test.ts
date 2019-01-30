module.exports = test;

import * as _ from 'lodash';
import chalk from 'chalk';
import * as snyk from '../../lib/';
import * as config from '../../lib/config';
import * as isCI from '../../lib/is-ci';
import {exists as apiTokenExists} from '../../lib/api-token';
import {SEVERITIES, WIZARD_SUPPORTED_PMS} from '../../lib/snyk-test/common';
import * as docker from '../../lib/docker-promotion';
import * as Debug from 'debug';

const debug = Debug('snyk');
const SEPARATOR = '\n-------------------------------------------------------\n';

// TODO: avoid using `as any` whenever it's possible

// arguments array is 0 or more `path` strings followed by
// an optional `option` object
async function test(...args) {
  const resultOptions = [] as any[];
  let results = [] as any[];
  let options = {} as any;

  if (typeof args[args.length - 1] === 'object') {
    options = args.pop();
  }

  // populate with default path (cwd) if no path given
  if (args.length === 0) {
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

  await apiTokenExists('snyk test');

  // Promise waterfall to test all other paths sequentially
  for (const path of args) {
    // Create a copy of the options so a specific test can
    // modify them i.e. add `options.file` etc. We'll need
    // these options later.
    const testOpts = _.cloneDeep(options);
    testOpts.path = path;
    resultOptions.push(testOpts);

    let res;

    try {
      res = await snyk.test(path, testOpts);
    } catch (error) {
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
        res = error;
      } else if (typeof error !== 'object') {
        res = new Error(error);
      } else {
        try {
          res = JSON.parse(error.message);
        } catch (unused) {
          res = error;
        }
      }
    }

    // add the tested path to the result of the test (or error)
    results.push(_.assign(res, {path}));
  }

  // resultOptions is now an array of 1 or more options used for
  // the tests results is now an array of 1 or more test results
  // values depend on `options.json` value - string or object
  if (options.json) {
    results = results.map((result) => {
      // add json for when thrown exception
      if (result instanceof Error) {
        return {
          ok: false,
          error: result.message,
          path: (result as any).path,
        };
      }
      return result;
    });

    // backwards compat - strip array IFF only one result
    const dataToSend = results.length === 1 ? results[0] : results;
    const json = JSON.stringify(dataToSend, null, 2);

    if (results.every((res) => res.ok)) {
      return json;
    }

    throw new Error(json);
  }

  let response = results.map((unused, i) => displayResult(results[i], resultOptions[i]))
    .join(`\n${SEPARATOR}`);

  const vulnerableResults = results.filter((res) => res.vulnerabilities && res.vulnerabilities.length);
  const errorResults = results.filter((res) => res instanceof Error);

  if (errorResults.length > 0) {
    debug(`Failed to test ${errorResults.length} projects, errors:`);
    errorResults.forEach((err) => {
      const errString = err.stack ? err.stack.toString() : err.toString();
      debug('error: %s', errString);
    });
  }

  let summaryMessage = '';

  if (results.length > 1) {
    const projects = results.length === 1 ? 'project' : 'projects';
    summaryMessage = `\n\n\nTested ${results.length} ${projects}` +
      summariseVulnerableResults(vulnerableResults, options) +
      summariseErrorResults(errorResults) + '\n';
  }

  const notSuccess = vulnerableResults.length > 0 || errorResults.length > 0;

  if (notSuccess) {
    response += chalk.bold.red(summaryMessage);
    const error = new Error(response) as any;
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
}

function summariseVulnerableResults(vulnerableResults, options) {
  const vulnsLength = vulnerableResults.length;
  if (vulnsLength) {
    if (options.showVulnPaths) {
      return `, ${vulnsLength} contained vulnerable paths.`;
    }
    return `, ${vulnsLength} had issues.`;
  }

  if (options.showVulnPaths) {
    return ', no vulnerable paths were found.';
  }

  return ', no issues were found.';
}

function summariseErrorResults(errorResults) {
  const projects = errorResults.length > 1 ? 'projects' : 'project';
  if (errorResults.length > 0) {
    return ` Failed to test ${errorResults.length} ${projects}.\n` +
      'Run with `-d` for debug output and contact support@snyk.io';
  }

  return '';
}

function displayResult(res, options) {
  const meta = metaForDisplay(res, options) + '\n\n';
  const dockerAdvice = dockerRemediationForDisplay(res);
  const packageManager = options.packageManager;
  const prefix = chalk.bold.white('\nTesting ' + options.path + '...\n\n');

  // handle errors by extracting their message
  if (res instanceof Error) {
    return prefix + res.message;
  }
  const issuesText = res.licensesPolicy ? 'issues' : 'vulnerabilities';
  let pathOrDepsText = '';

  if (res.hasOwnProperty('dependencyCount')) {
    pathOrDepsText += res.dependencyCount + ' dependencies';
  } else {
    pathOrDepsText += options.path;
  }
  const testedInfoText = `Tested ${pathOrDepsText} for known ${issuesText}`;

  let dockerSuggestion = '';
  if (docker.shouldSuggestDocker(options)) {
    dockerSuggestion += chalk.bold.white(docker.suggestionText);
  }

  // OK  => no vulns found, return
  if (res.ok && res.vulnerabilities.length === 0) {
    const vulnPathsText = options.showVulnPaths ?
      ', no vulnerable paths found.' :
      ', none were found.';
    const summaryOKText = chalk.green(`✓ ${testedInfoText} ${vulnPathsText}`);
    const nextStepsText =
      '\n\nNext steps:' +
      '\n- Run `snyk monitor` to be notified ' +
      'about new related vulnerabilities.' +
      '\n- Run `snyk test` as part of ' +
      'your CI/test.';
    return (
      prefix + meta + summaryOKText + (
        isCI ? '' :
          dockerAdvice +
          nextStepsText +
          dockerSuggestion)
    );
  }

  // NOT OK => We found some vulns, let's format the vulns info
  const vulnCount = res.vulnerabilities && res.vulnerabilities.length;
  const singleVulnText = res.licensesPolicy ? 'issue' : 'vulnerability';
  const multipleVulnsText = res.licensesPolicy ? 'issues' : 'vulnerabilities';

  // Text will look like so:
  // 'found 232 vulnerabilities, 404 vulnerable paths.'
  let vulnCountText = `found ${res.uniqueCount} `
    + (res.uniqueCount === 1 ? singleVulnText : multipleVulnsText);

  // Docker is currently not supported as num of paths is inaccurate due to trimming of paths to reduce size.
  if (options.showVulnPaths && !options.docker) {
    vulnCountText += `, ${vulnCount} vulnerable `;

    if (vulnCount === 1) {
      vulnCountText += 'path.';
    } else {
      vulnCountText += 'paths.';
    }
  } else {
    vulnCountText += '.';
  }
  let summary = testedInfoText + ', ' + chalk.red.bold(vulnCountText);

  if (WIZARD_SUPPORTED_PMS.indexOf(packageManager) > -1) {
    summary += chalk.bold.green('\n\nRun `snyk wizard` to address these issues.');
  }

  if (options.docker &&
    !options.file &&
    (config.disableSuggestions !== 'true')) {
    dockerSuggestion += chalk.bold.white('\n\nPro tip: use `--file` option to get base image remediation advice.' +
      `\nExample: $ snyk test --docker ${options.path} --file=path/to/Dockerfile` +
      '\n\nTo remove this message in the future, please run `snyk config set disableSuggestions=true`');
  }

  const vulns = res.vulnerabilities || [];
  const groupedVulns = groupVulnerabilities(vulns);
  const sortedGroupedVulns = _.orderBy(
    groupedVulns,
    ['metadata.severityValue', 'metadata.name'],
    ['asc', 'desc'],
  );
  const filteredSortedGroupedVulns = sortedGroupedVulns
    .filter((vuln) => (vuln.metadata.packageManager !== 'upstream'));
  const binariesSortedGroupedVulns = sortedGroupedVulns
    .filter((vuln) => (vuln.metadata.packageManager === 'upstream'));
  const groupedVulnInfoOutput = filteredSortedGroupedVulns.map((vuln) => formatIssues(vuln, options));
  const groupedDockerBinariesVulnInfoOutput = (res.docker && res.docker.binariesVulns) ?
    formatDockerBinariesIssues(binariesSortedGroupedVulns, res.docker.binariesVulns, options) : [];

  const body =
    groupedVulnInfoOutput.join('\n\n') + '\n\n\n' +
    groupedDockerBinariesVulnInfoOutput.join('\n\n') + '\n\n' + meta + summary;

  return prefix + body + dockerAdvice + dockerSuggestion;
}

function formatDockerBinariesIssues(dockerBinariesSortedGroupedVulns, binariesVulns, options) {
  const binariesIssuesOutput = [] as string[];
  for (const pkgInfo of _.values(binariesVulns.affectedPkgs)) {
    binariesIssuesOutput.push(createDockerBinaryHeading(pkgInfo));
    const binaryIssues = dockerBinariesSortedGroupedVulns
      .filter((vuln) => (vuln.metadata.name === pkgInfo.pkg.name));
    const formattedBinaryIssues = binaryIssues.map((vuln) => formatIssues(vuln, options));
    binariesIssuesOutput.push(formattedBinaryIssues.join('\n\n'));
  }
  return binariesIssuesOutput;
}

function createDockerBinaryHeading(pkgInfo) {
  const binaryName = pkgInfo.pkg.name;
  const binaryVersion = pkgInfo.pkg.version;
  const numOfVulns = _.values(pkgInfo.issues).length;
  return numOfVulns ?
    chalk.bold.white(`------------ Detected ${numOfVulns} vulnerabilities` +
      ` for ${binaryName}@${binaryVersion} ------------`, '\n') : '';
}

function formatIssues(vuln, options) {
  const vulnID = vuln.list[0].id;
  const packageManager = options.packageManager;
  const uniquePackages = _.uniq(
    vuln.list.map((i) => {
      if (i.from[1]) {
        return i.from && i.from[1];
      }
      return i.from;
    }))
    .join(', ');

  let version;
  if (vuln.metadata.packageManager.toLowerCase() === 'upstream') {
    version = vuln.metadata.version;
  }

  const vulnOutput = {
    issueHeading: createSeverityBasedIssueHeading(
      vuln.metadata.severity,
      vuln.metadata.type,
      vuln.metadata.name,
      false,
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
    dockerfilePackage: options.docker ? dockerfileInstructionText(vuln) : '',
  };

  return (
    `${vulnOutput.issueHeading}\n` +
    `${vulnOutput.description}\n` +
    `${vulnOutput.info}\n` +
    `${vulnOutput.introducedThrough}\n` +
    vulnOutput.fromPaths +
    // Optional - not always there
    vulnOutput.remediationInfo +
    vulnOutput.dockerfilePackage +
    vulnOutput.fixedIn +
    vulnOutput.extraInfo
  );
}

function dockerfileInstructionText(vuln) {
  if (vuln.dockerfileInstruction) {
    return `\n  Introduced in your Dockerfile by '${ vuln.dockerfileInstruction }'`;
  }

  if (vuln.dockerBaseImage) {
    return `\n  Introduced by your base image (${ vuln.dockerBaseImage })`;
  }

  return '';
}

function createFixedInText(vuln: any): string {
  return vuln.nearestFixedInVersion ?
    chalk.bold('\n  Fixed in: ' + vuln.nearestFixedInVersion )
    : '';
}

function createRemediationText(vuln, packageManager) {
  const packageName = vuln.metadata.name;
  let wizardHintText = '';
  if (WIZARD_SUPPORTED_PMS.indexOf(packageManager) > -1) {
    wizardHintText = 'Run `snyk wizard` to explore remediation options.';
  }

  if (vuln.isOutdated === true) {
    const packageManagerOutdatedText = {
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
    const upgradePathsArray = _.uniq(vuln.list.map((v) => {
      const shouldUpgradeItself = !!v.upgradePath[0];
      const shouldUpgradeDirectDep = !!v.upgradePath[1];

      if (shouldUpgradeItself) {
        // If we are testing a library/package like express
        // Then we can suggest they get the latest version
        // Example command: snyk test express@3
        const selfUpgradeInfo = (v.upgradePath.length > 0)
          ? ` (triggers upgrades to ${ v.upgradePath.join(' > ')})`
          : '';
        const testedPackageName = v.upgradePath[0].split('@');
        return `You've tested an outdated version of ${testedPackageName[0]}.` +
           + ` Upgrade to ${v.upgradePath[0]}${selfUpgradeInfo}`;
      }
      if (shouldUpgradeDirectDep) {
        const formattedUpgradePath = v.upgradePath.slice(1).join(' > ');
        const upgradeTextInfo = (v.upgradePath.length)
          ? ` (triggers upgrades to ${formattedUpgradePath})`
          : '';

        return `Upgrade direct dependency ${v.from[1]} to ${v.upgradePath[1]}${upgradeTextInfo}`;
      }

      return 'Some paths have no direct dependency upgrade that' +
        ` can address this issue. ${wizardHintText}`;
    }));
    return chalk.bold(`\n  Remediation: \n    ${upgradePathsArray.join('\n    ')}`);
  }

  return '';
}

function createSeverityBasedIssueHeading(severity, type, packageName, isNew) {
  // Example: ✗ Medium severity vulnerability found in xmldom
  const vulnTypeText = type === 'license' ? 'issue' : 'vulnerability';
  const severitiesColourMapping = {
    low: {
      colorFunc(text) {
        return chalk.bold.blue(text);
      },
    },
    medium: {
      colorFunc(text) {
        return chalk.bold.yellow(text);
      },
    },
    high: {
      colorFunc(text) {
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
  const numberOfPathsToDisplay = 3;
  const fromPathsArray = vulnList.map((i) => i.from);

  const formatedFromPathsArray = fromPathsArray.map((i) => {
    const fromWithoutBaseProject = i.slice(1);
    // If more than one From path
    if (fromWithoutBaseProject.length) {
      return i.slice(1).join(' > ');
    }
    // Else issue is in the core package
    return i;
  });

  const notShownPathsNumber = fromPathsArray.length - numberOfPathsToDisplay;
  const shouldTruncatePaths = fromPathsArray.length > 3;
  const truncatedText = `\n  and ${notShownPathsNumber} more...`;
  const formattedPathsText = formatedFromPathsArray
    .slice(0, numberOfPathsToDisplay)
    .join('\n  From: ');

  if (fromPathsArray.length > 0) {
    return '  From: ' + formattedPathsText + (shouldTruncatePaths ? truncatedText : '');
  }
}

function rightPadWithSpaces(s, desiredLength) {
  const padLength = desiredLength - s.length;
  if (padLength <= 0) {
    return s;
  }

  return s + ' '.repeat(padLength);
}

function metaForDisplay(res, options) {
  const padToLength = 19; // chars to align
  const packageManager = options.packageManager || res.packageManager;
  const openSource = res.isPrivate ? 'no' : 'yes';
  const meta = [
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
  const out = [] as any[];

  if (advice) {
    for (const item of advice) {
      out.push(item.bold ? chalk.bold(item.message) : item.message);
    }
  } else if (message) {
    out.push(message);
  } else {
    return '';
  }

  return `\n\n${out.join('\n')}`;
}

function validateSeverityThreshold(severityThreshold) {
  return SEVERITIES
    .map((s) => s.verboseName)
    .indexOf(severityThreshold) > -1;
}

function getSeverityValue(severity) {
  return SEVERITIES.find((severityObj) => severityObj.verboseName === severity)!.value;
}

function titleCaseText(text) {
  return text[0].toUpperCase() + text.slice(1);
}

// This is all a copy from Registry snapshots/index
function isVulnFixable(vuln) {
  return (vuln.isUpgradable || vuln.isPatchable) && !vuln.isOutdated;
}

function groupVulnerabilities(vulns) {
  return vulns.reduce((map, curr) => {
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
      map[curr.id].dockerfileInstruction = curr.dockerfileInstruction;
      map[curr.id].dockerBaseImage = curr.dockerBaseImage;
      map[curr.id].nearestFixedInVersion = curr.nearestFixedInVersion;
    }
    if (curr.upgradePath) {
      curr.isOutdated = curr.upgradePath[1] === curr.from[1];
    }
    map[curr.id].list.push(curr);
    if (!map[curr.id].isFixable) {
      map[curr.id].isFixable = isVulnFixable(curr);
    }

    if (!map[curr.id].isOutdated) {
      map[curr.id].isOutdated = !!curr.isOutdated;
    }

    if (!map[curr.id].note) {
      map[curr.id].note = !!curr.note;
    }

    return map;
  }, {});
}
// check if vuln was published in the last month
function isNewVuln(vuln) {
  const MONTH = 30 * 24 * 60 * 60 * 1000;
  const publicationTime = (new Date(vuln.publicationTime)).getTime();
  return publicationTime > Date.now() - MONTH;
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
    version: vuln.version,
    packageManager: vuln.packageManager,
  };
}
