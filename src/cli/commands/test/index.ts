export = test;

import * as _ from '@snyk/lodash';
import chalk from 'chalk';
import * as snyk from '../../../lib';
import * as config from '../../../lib/config';
import { isCI } from '../../../lib/is-ci';
import { apiTokenExists } from '../../../lib/api-token';
import { FAIL_ON, FailOn, SEVERITIES } from '../../../lib/snyk-test/common';
import * as Debug from 'debug';
import {
  Options,
  ShowVulnPaths,
  SupportedProjectTypes,
  TestOptions,
} from '../../../lib/types';
import { isLocalFolder } from '../../../lib/detect';
import { MethodArgs } from '../../args';
import {
  GroupedVuln,
  LegacyVulnApiResult,
  SEVERITY,
  TestResult,
  VulnMetaData,
} from '../../../lib/snyk-test/legacy';
import {
  SupportedPackageManagers,
  WIZARD_SUPPORTED_PACKAGE_MANAGERS,
} from '../../../lib/package-managers';

import * as analytics from '../../../lib/analytics';
import { FailOnError } from '../../../lib/errors/fail-on-error.ts';
import {
  dockerRemediationForDisplay,
  formatDockerBinariesIssues,
  formatIssues,
  formatIssuesWithRemediation,
  formatTestMeta,
  getSeverityValue,
  summariseErrorResults,
  summariseReachableVulns,
  summariseVulnerableResults,
} from './formatters';
import * as utils from './utils';

const debug = Debug('snyk-test');
const SEPARATOR = '\n-------------------------------------------------------\n';

const showVulnPathsMapping: Record<string, ShowVulnPaths> = {
  false: 'none',
  none: 'none',
  true: 'some',
  some: 'some',
  all: 'all',
};

// TODO: avoid using `as any` whenever it's possible

async function test(...args: MethodArgs): Promise<string> {
  const resultOptions = [] as any[];
  let results = [] as any[];
  let options = ({} as any) as Options & TestOptions;

  if (typeof args[args.length - 1] === 'object') {
    options = (args.pop() as any) as Options & TestOptions;
  }

  // populate with default path (cwd) if no path given
  if (args.length === 0) {
    args.unshift(process.cwd());
  }
  // org fallback to config unless specified
  options.org = options.org || config.org;

  // making `show-vulnerable-paths` 'some' by default.
  const svpSupplied = (options['show-vulnerable-paths'] || '').toLowerCase();
  options.showVulnPaths = showVulnPathsMapping[svpSupplied] || 'some';

  if (
    options.severityThreshold &&
    !validateSeverityThreshold(options.severityThreshold)
  ) {
    return Promise.reject(new Error('INVALID_SEVERITY_THRESHOLD'));
  }

  if (options.failOn && !validateFailOn(options.failOn)) {
    const error = new FailOnError();
    return Promise.reject(chalk.red.bold(error.message));
  }

  apiTokenExists();

  // Promise waterfall to test all other paths sequentially
  for (const path of args as string[]) {
    // Create a copy of the options so a specific test can
    // modify them i.e. add `options.file` etc. We'll need
    // these options later.
    const testOpts = _.cloneDeep(options);
    testOpts.path = path;
    testOpts.projectName = testOpts['project-name'];

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

    // Not all test results are arrays in order to be backwards compatible
    // with scripts that use a callback with test. Coerce results/errors to be arrays
    // and add the result options to each to be displayed
    const resArray: any[] = Array.isArray(res) ? res : [res];

    for (let i = 0; i < resArray.length; i++) {
      const pathWithOptionalProjectName = utils.getPathWithOptionalProjectName(
        path,
        resArray[i],
      );
      results.push(
        _.assign(resArray[i], { path: pathWithOptionalProjectName }),
      );
      // currently testOpts are identical for each test result returned even if it's for multiple projects.
      // we want to return the project names, so will need to be crafty in a way that makes sense.
      if (!testOpts.projectNames) {
        resultOptions.push(testOpts);
      } else {
        resultOptions.push(
          _.assign(_.cloneDeep(testOpts), {
            projectName: testOpts.projectNames[i],
          }),
        );
      }
    }
  }

  const vulnerableResults = results.filter(
    (res) => res.vulnerabilities && res.vulnerabilities.length,
  );
  const errorResults = results.filter((res) => res instanceof Error);
  const notSuccess = errorResults.length > 0;
  const foundVulnerabilities = vulnerableResults.length > 0;

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
    const stringifiedData = JSON.stringify(dataToSend, null, 2);

    if (results.every((res) => res.ok)) {
      return stringifiedData;
    }

    const err = new Error(stringifiedData) as any;

    if (foundVulnerabilities) {
      if (options.failOn) {
        const fail = shouldFail(vulnerableResults, options.failOn);
        if (!fail) {
          // return here to prevent failure
          return stringifiedData;
        }
      }
      err.code = 'VULNS';
      const dataToSendNoVulns = dataToSend;
      delete dataToSendNoVulns.vulnerabilities;
      err.jsonNoVulns = dataToSendNoVulns;
    }

    err.json = stringifiedData;
    throw err;
  }

  const pinningSupported: LegacyVulnApiResult = results.find(
    (res) => res.packageManager === 'pip',
  );

  let response = results
    .map((unused, i) => {
      resultOptions[i].pinningSupported = pinningSupported;
      return displayResult(results[i] as LegacyVulnApiResult, resultOptions[i]);
    })
    .join(`\n${SEPARATOR}`);

  if (notSuccess) {
    debug(`Failed to test ${errorResults.length} projects, errors:`);
    errorResults.forEach((err) => {
      const errString = err.stack ? err.stack.toString() : err.toString();
      debug('error: %s', errString);
    });
  }

  let summaryMessage = '';

  if (results.length > 1) {
    const projects = results.length === 1 ? 'project' : 'projects';
    summaryMessage =
      `\n\n\nTested ${results.length} ${projects}` +
      summariseVulnerableResults(vulnerableResults, options) +
      summariseErrorResults(errorResults.length) +
      '\n';
  }

  if (notSuccess) {
    response += chalk.bold.red(summaryMessage);
    const error = new Error(response) as any;
    // take the code of the first problem to go through error
    // translation
    // HACK as there can be different errors, and we pass only the
    // first one
    error.code = errorResults[0].code;
    error.userMessage = errorResults[0].userMessage;
    throw error;
  }

  if (foundVulnerabilities) {
    if (options.failOn) {
      const fail = shouldFail(vulnerableResults, options.failOn);
      if (!fail) {
        // return here to prevent throwing failure
        response += chalk.bold.green(summaryMessage);
        return response;
      }
    }

    response += chalk.bold.red(summaryMessage);
    const error = new Error(response) as any;
    // take the code of the first problem to go through error
    // translation
    // HACK as there can be different errors, and we pass only the
    // first one
    error.code = vulnerableResults[0].code || 'VULNS';
    error.userMessage = vulnerableResults[0].userMessage;
    throw error;
  }

  response += chalk.bold.green(summaryMessage);
  return response;
}

function shouldFail(vulnerableResults: any[], failOn: FailOn) {
  // find reasons not to fail
  if (failOn === 'all') {
    return hasFixes(vulnerableResults);
  }
  if (failOn === 'upgradable') {
    return hasUpgrades(vulnerableResults);
  }
  if (failOn === 'patchable') {
    return hasPatches(vulnerableResults);
  }
  // should fail by default when there are vulnerable results
  return vulnerableResults.length > 0;
}

function isFixable(testResult: any): boolean {
  return isUpgradable(testResult) || isPatchable(testResult);
}

function hasFixes(testResults: any[]): boolean {
  return testResults.some(isFixable);
}

function isUpgradable(testResult: any): boolean {
  if (testResult.remediation) {
    const {
      remediation: { upgrade = {}, pin = {} },
    } = testResult;
    return Object.keys(upgrade).length > 0 || Object.keys(pin).length > 0;
  }
  // if remediation is not available, fallback on vuln properties
  const { vulnerabilities = {} } = testResult;
  return vulnerabilities.some(isVulnUpgradable);
}

function hasUpgrades(testResults: any[]): boolean {
  return testResults.some(isUpgradable);
}

function isPatchable(testResult: any): boolean {
  if (testResult.remediation) {
    const {
      remediation: { patch = {} },
    } = testResult;
    return Object.keys(patch).length > 0;
  }
  // if remediation is not available, fallback on vuln properties
  const { vulnerabilities = {} } = testResult;
  return vulnerabilities.some(isVulnPatchable);
}

function hasPatches(testResults: any[]): boolean {
  return testResults.some(isPatchable);
}

function isVulnUpgradable(vuln) {
  return vuln.isUpgradable || vuln.isPinnable;
}

function isVulnPatchable(vuln) {
  return vuln.isPatchable;
}

function isVulnFixable(vuln) {
  return isVulnUpgradable(vuln) || isVulnPatchable(vuln);
}

function displayResult(
  res: TestResult,
  options: Options & TestOptions,
  foundProjectCount?: number,
) {
  const meta = formatTestMeta(res, options);
  const dockerAdvice = dockerRemediationForDisplay(res);
  const projectType =
    (res.packageManager as SupportedProjectTypes) || options.packageManager;
  const localPackageTest = isLocalFolder(options.path);
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

  let multiProjAdvice = '';

  const advertiseGradleSubProjectsCount =
    projectType === 'gradle' && !options['gradle-sub-project'];
  if (advertiseGradleSubProjectsCount && foundProjectCount) {
    multiProjAdvice = chalk.bold.white(
      `\n\nThis project has multiple sub-projects (${foundProjectCount}), ` +
        'use --all-sub-projects flag to scan all sub-projects.',
    );
  }

  // OK  => no vulns found, return
  if (res.ok && res.vulnerabilities.length === 0) {
    const vulnPathsText = options.showVulnPaths
      ? 'no vulnerable paths found.'
      : 'none were found.';
    const summaryOKText = chalk.green(`✓ ${testedInfoText}, ${vulnPathsText}`);
    const nextStepsText = localPackageTest
      ? '\n\nNext steps:' +
        '\n- Run `snyk monitor` to be notified ' +
        'about new related vulnerabilities.' +
        '\n- Run `snyk test` as part of ' +
        'your CI/test.'
      : '';
    // user tested a package@version and got 0 vulns back, but there were dev deps
    // to consider
    const snykPackageTestTip: string = !(
      options.docker ||
      localPackageTest ||
      options.dev
    )
      ? '\n\nTip: Snyk only tests production dependencies by default. You can try re-running with the `--dev` flag.'
      : '';
    return (
      prefix +
      meta +
      '\n\n' +
      summaryOKText +
      multiProjAdvice +
      (isCI() ? '' : dockerAdvice + nextStepsText + snykPackageTestTip)
    );
  }

  // NOT OK => We found some vulns, let's format the vulns info

  return getDisplayedOutput(
    res,
    options,
    testedInfoText,
    localPackageTest,
    projectType,
    meta,
    prefix,
    multiProjAdvice,
    dockerAdvice,
  );
}

function getDisplayedOutput(
  res: TestResult,
  options: Options & TestOptions,
  testedInfoText: string,
  localPackageTest: any,
  projectType: string,
  meta: string,
  prefix: string,
  multiProjAdvice: string,
  dockerAdvice: string,
): string {
  const vulnCount = res.vulnerabilities && res.vulnerabilities.length;
  const singleVulnText = res.licensesPolicy ? 'issue' : 'vulnerability';
  const multipleVulnsText = res.licensesPolicy ? 'issues' : 'vulnerabilities';

  // Text will look like so:
  // 'found 232 vulnerabilities, 404 vulnerable paths.'
  let vulnCountText =
    `found ${res.uniqueCount} ` +
    (res.uniqueCount === 1 ? singleVulnText : multipleVulnsText);

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

  const reachableVulnsText =
    options.reachableVulns && vulnCount > 0
      ? ` ${summariseReachableVulns(res.vulnerabilities)}`
      : '';

  const summary =
    testedInfoText +
    ', ' +
    chalk.red.bold(vulnCountText) +
    chalk.blue.bold(reachableVulnsText);
  let wizardAdvice = '';

  if (
    localPackageTest &&
    WIZARD_SUPPORTED_PACKAGE_MANAGERS.includes(
      projectType as SupportedPackageManagers,
    )
  ) {
    wizardAdvice = chalk.bold.green(
      '\n\nRun `snyk wizard` to address these issues.',
    );
  }
  let dockerSuggestion = '';
  if (options.docker && config.disableSuggestions !== 'true') {
    const optOutSuggestions =
      '\n\nTo remove this message in the future, please run `snyk config set disableSuggestions=true`';
    if (!options.file) {
      dockerSuggestion +=
        chalk.bold.white(
          '\n\nPro tip: use `--file` option to get base image remediation advice.' +
            `\nExample: $ snyk test --docker ${options.path} --file=path/to/Dockerfile`,
        ) + optOutSuggestions;
    } else if (!options['exclude-base-image-vulns']) {
      dockerSuggestion +=
        chalk.bold.white(
          '\n\nPro tip: use `--exclude-base-image-vulns` to exclude from display Docker base image vulnerabilities.',
        ) + optOutSuggestions;
    }
  }

  const vulns = res.vulnerabilities || [];
  const groupedVulns: GroupedVuln[] = groupVulnerabilities(vulns);
  const sortedGroupedVulns = _.orderBy(
    groupedVulns,
    ['metadata.severityValue', 'metadata.name'],
    ['asc', 'desc'],
  );
  const filteredSortedGroupedVulns = sortedGroupedVulns.filter(
    (vuln) => vuln.metadata.packageManager !== 'upstream',
  );
  const binariesSortedGroupedVulns = sortedGroupedVulns.filter(
    (vuln) => vuln.metadata.packageManager === 'upstream',
  );

  let groupedVulnInfoOutput;
  if (res.remediation) {
    analytics.add('actionableRemediation', true);
    groupedVulnInfoOutput = formatIssuesWithRemediation(
      filteredSortedGroupedVulns,
      res.remediation,
      options,
    );
  } else {
    analytics.add('actionableRemediation', false);
    groupedVulnInfoOutput = filteredSortedGroupedVulns.map((vuln) =>
      formatIssues(vuln, options),
    );
  }

  const groupedDockerBinariesVulnInfoOutput =
    res.docker && binariesSortedGroupedVulns.length
      ? formatDockerBinariesIssues(
          binariesSortedGroupedVulns,
          res.docker.binariesVulns,
          options,
        )
      : [];

  let body =
    groupedVulnInfoOutput.join('\n\n') +
    '\n\n' +
    groupedDockerBinariesVulnInfoOutput.join('\n\n') +
    '\n\n' +
    meta;

  if (res.remediation) {
    body = summary + body + wizardAdvice;
  } else {
    body = body + '\n\n' + summary + wizardAdvice;
  }

  const ignoredIssues = '';
  return (
    prefix +
    body +
    multiProjAdvice +
    ignoredIssues +
    dockerAdvice +
    dockerSuggestion
  );
}

function validateSeverityThreshold(severityThreshold) {
  return SEVERITIES.map((s) => s.verboseName).indexOf(severityThreshold) > -1;
}

function validateFailOn(arg: FailOn) {
  return Object.keys(FAIL_ON).includes(arg);
}

function groupVulnerabilities(vulns): GroupedVuln[] {
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
      map[curr.id].severity = curr.severity as SEVERITY;
      map[curr.id].isNew = isNewVuln(curr);
      map[curr.id].name = curr.name;
      map[curr.id].version = curr.version;
      map[curr.id].fixedIn = curr.fixedIn;
      map[curr.id].dockerfileInstruction = curr.dockerfileInstruction;
      map[curr.id].dockerBaseImage = curr.dockerBaseImage;
      map[curr.id].nearestFixedInVersion = curr.nearestFixedInVersion;
      map[curr.id].legalInstructionsArray = curr.legalInstructionsArray;
      map[curr.id].reachability = curr.reachability;
    }

    map[curr.id].list.push(curr);
    if (!map[curr.id].isFixable) {
      map[curr.id].isFixable = isVulnFixable(curr);
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
  const publicationTime = new Date(vuln.publicationTime).getTime();
  return publicationTime > Date.now() - MONTH;
}

function metadataForVuln(vuln): VulnMetaData {
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
