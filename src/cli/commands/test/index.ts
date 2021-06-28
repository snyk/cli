export = test;

import * as Debug from 'debug';
import * as pathLib from 'path';
const cloneDeep = require('lodash.clonedeep');
const assign = require('lodash.assign');
import chalk from 'chalk';

import * as snyk from '../../../lib';
import { isCI } from '../../../lib/is-ci';
import {
  IacFileInDirectory,
  Options,
  SupportedProjectTypes,
  TestOptions,
} from '../../../lib/types';
import { isLocalFolder } from '../../../lib/detect';
import { MethodArgs } from '../../args';
import { TestCommandResult } from '../../commands/types';
import { LegacyVulnApiResult, TestResult } from '../../../lib/snyk-test/legacy';
import {
  IacTestResponse,
  mapIacTestResult,
} from '../../../lib/snyk-test/iac-test-result';

import {
  dockerRemediationForDisplay,
  formatTestMeta,
  summariseErrorResults,
  summariseVulnerableResults,
} from './formatters';
import * as utils from './utils';
import {
  getIacDisplayedOutput,
  getIacDisplayErrorFileOutput,
} from './iac-output';
import { getEcosystemForTest, testEcosystem } from '../../../lib/ecosystems';
import { isMultiProjectScan } from '../../../lib/is-multi-project-scan';
import {
  IacProjectType,
  IacProjectTypes,
  TEST_SUPPORTED_IAC_PROJECTS,
} from '../../../lib/iac/constants';
import { hasFixes, hasPatches, hasUpgrades } from './vuln-helpers';
import { FailOn } from '../../../lib/snyk-test/common';
import {
  createErrorMappedResultsForJsonOutput,
  dockerUserCTA,
  extractDataToSendFromResults,
  getDisplayedOutput,
} from './formatters/format-test-results';

import { test as iacTest } from './iac-test-shim';
import { validateCredentials } from './validate-credentials';
import { validateTestOptions } from './validate-test-options';
import { setDefaultTestOptions } from './set-default-test-options';
import { processCommandArgs } from '../process-command-args';
import { formatTestError } from './format-test-error';

const debug = Debug('snyk-test');
const SEPARATOR = '\n-------------------------------------------------------\n';

// TODO: avoid using `as any` whenever it's possible

async function test(...args: MethodArgs): Promise<TestCommandResult> {
  const { options: originalOptions, paths } = processCommandArgs(...args);
  const options = setDefaultTestOptions(originalOptions);
  validateTestOptions(options);
  validateCredentials(options);

  const ecosystem = getEcosystemForTest(options);
  if (ecosystem) {
    try {
      const commandResult = await testEcosystem(ecosystem, paths, options);
      return commandResult;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(error);
      }
    }
  }

  const resultOptions: Array<Options & TestOptions> = [];
  const results = [] as any[];

  // Holds an array of scanned file metadata for output.
  let iacScanFailures: IacFileInDirectory[] | undefined;

  // Promise waterfall to test all other paths sequentially
  for (const path of paths) {
    // Create a copy of the options so a specific test can
    // modify them i.e. add `options.file` etc. We'll need
    // these options later.
    const testOpts = cloneDeep(options);
    testOpts.path = path;
    testOpts.projectName = testOpts['project-name'];

    let res: (TestResult | TestResult[]) | Error;
    try {
      if (options.iac) {
        // this path is an experimental feature feature for IaC which does issue scanning locally without sending files to our Backend servers.
        // once ready for GA, it is aimed to deprecate our remote-processing model, so IaC file scanning in the CLI is done locally.
        const { results, failures } = await iacTest(path, testOpts);
        res = results;
        iacScanFailures = failures;
      } else {
        res = await snyk.test(path, testOpts);
      }
    } catch (error) {
      // not throwing here but instead returning error response
      // for legacy flow reasons.
      res = formatTestError(error);
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
      results.push(assign(resArray[i], { path: pathWithOptionalProjectName }));
      // currently testOpts are identical for each test result returned even if it's for multiple projects.
      // we want to return the project names, so will need to be crafty in a way that makes sense.
      if (!testOpts.projectNames) {
        resultOptions.push(testOpts);
      } else {
        resultOptions.push(
          assign(cloneDeep(testOpts), {
            projectName: testOpts.projectNames[i],
          }),
        );
      }
    }
  }

  const vulnerableResults = results.filter(
    (res) =>
      (res.vulnerabilities && res.vulnerabilities.length) ||
      (res.result &&
        res.result.cloudConfigResults &&
        res.result.cloudConfigResults.length),
  );
  const errorResults = results.filter((res) => res instanceof Error);
  const notSuccess = errorResults.length > 0;
  const foundVulnerabilities = vulnerableResults.length > 0;

  // resultOptions is now an array of 1 or more options used for
  // the tests results is now an array of 1 or more test results
  // values depend on `options.json` value - string or object
  const errorMappedResults = !options.iac
    ? createErrorMappedResultsForJsonOutput(results)
    : results.map(mapIacTestResult);

  // backwards compat - strip array IFF only one result
  const jsonData =
    errorMappedResults.length === 1
      ? errorMappedResults[0]
      : errorMappedResults;

  const {
    stdout: dataToSend,
    stringifiedData,
    stringifiedJsonData,
    stringifiedSarifData,
  } = extractDataToSendFromResults(results, jsonData, options);

  if (options.json || options.sarif) {
    // if all results are ok (.ok == true)
    if (errorMappedResults.every((res) => res.ok)) {
      return TestCommandResult.createJsonTestCommandResult(
        stringifiedData,
        stringifiedJsonData,
        stringifiedSarifData,
      );
    }

    const err = new Error(stringifiedData) as any;

    if (foundVulnerabilities) {
      if (options.failOn) {
        const fail = shouldFail(vulnerableResults, options.failOn);
        if (!fail) {
          // return here to prevent failure
          return TestCommandResult.createJsonTestCommandResult(
            stringifiedData,
            stringifiedJsonData,
            stringifiedSarifData,
          );
        }
      }
      err.code = 'VULNS';
      const dataToSendNoVulns = dataToSend;
      delete dataToSendNoVulns.vulnerabilities;
      err.jsonNoVulns = dataToSendNoVulns;
    }

    if (notSuccess) {
      // Take the code of the first problem to go through error
      // translation.
      // Note: this is done based on the logic done below
      // for non-json/sarif outputs, where we take the code of
      // the first error.
      err.code = errorResults[0].code;
    }
    err.json = stringifiedData;
    err.jsonStringifiedResults = stringifiedJsonData;
    err.sarifStringifiedResults = stringifiedSarifData;
    throw err;
  }

  let response = results
    .map((result, i) => {
      return displayResult(
        results[i] as LegacyVulnApiResult,
        resultOptions[i],
        result.foundProjectCount,
      );
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
  let errorResultsLength = errorResults.length;

  if (options.iac && iacScanFailures) {
    errorResultsLength = iacScanFailures.length || errorResults.length;

    for (const reason of iacScanFailures) {
      response += chalk.bold.red(getIacDisplayErrorFileOutput(reason));
    }
  }

  if (results.length > 1) {
    const projects = results.length === 1 ? 'project' : 'projects';
    summaryMessage =
      `\n\n\nTested ${results.length} ${projects}` +
      summariseVulnerableResults(vulnerableResults, options) +
      summariseErrorResults(errorResultsLength) +
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
    error.strCode = errorResults[0].strCode;
    throw error;
  }

  if (foundVulnerabilities) {
    if (options.failOn) {
      const fail = shouldFail(vulnerableResults, options.failOn);
      if (!fail) {
        // return here to prevent throwing failure
        response += chalk.bold.green(summaryMessage);
        return TestCommandResult.createHumanReadableTestCommandResult(
          response,
          stringifiedJsonData,
          stringifiedSarifData,
        );
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
    error.jsonStringifiedResults = stringifiedJsonData;
    error.sarifStringifiedResults = stringifiedSarifData;
    throw error;
  }

  response += chalk.bold.green(summaryMessage);
  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    stringifiedJsonData,
    stringifiedSarifData,
  );
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
  let testingPath = options.path;
  if (options.iac && res.targetFile) {
    testingPath = pathLib.basename(res.targetFile);
  }
  const prefix = chalk.bold('\nTesting ' + testingPath + '...\n\n');

  // handle errors by extracting their message
  if (res instanceof Error) {
    return prefix + res.message;
  }
  const issuesText =
    res.licensesPolicy ||
    TEST_SUPPORTED_IAC_PROJECTS.includes(projectType as IacProjectTypes)
      ? 'issues'
      : 'vulnerabilities';
  let pathOrDepsText = '';

  if (res.dependencyCount) {
    pathOrDepsText += res.dependencyCount + ' dependencies';
  } else if (options.iac && res.targetFile) {
    pathOrDepsText += pathLib.basename(res.targetFile);
  } else {
    pathOrDepsText += options.path;
  }
  const testedInfoText = `Tested ${pathOrDepsText} for known ${issuesText}`;

  let multiProjAdvice = '';

  const advertiseGradleSubProjectsCount =
    projectType === 'gradle' &&
    !options['gradle-sub-project'] &&
    !options.allProjects &&
    foundProjectCount;
  if (advertiseGradleSubProjectsCount) {
    multiProjAdvice = chalk.bold.white(
      `\n\nTip: This project has multiple sub-projects (${foundProjectCount}), ` +
        'use --all-sub-projects flag to scan all sub-projects.',
    );
  }
  const advertiseAllProjectsCount =
    projectType !== 'gradle' &&
    !isMultiProjectScan(options) &&
    foundProjectCount;
  if (advertiseAllProjectsCount) {
    multiProjAdvice = chalk.bold.white(
      `\n\nTip: Detected multiple supported manifests (${foundProjectCount}), ` +
        'use --all-projects to scan all of them at once.',
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
    // to consider
    const snykPackageTestTip: string = !(
      options.docker ||
      localPackageTest ||
      options.dev
    )
      ? '\n\nTip: Snyk only tests production dependencies by default. You can try re-running with the `--dev` flag.'
      : '';

    const dockerCTA = dockerUserCTA(options);
    return (
      prefix +
      meta +
      '\n\n' +
      summaryOKText +
      multiProjAdvice +
      (isCI()
        ? ''
        : dockerAdvice + nextStepsText + snykPackageTestTip + dockerCTA)
    );
  }

  if (
    TEST_SUPPORTED_IAC_PROJECTS.includes(res.packageManager as IacProjectType)
  ) {
    return getIacDisplayedOutput(
      (res as any) as IacTestResponse,
      testedInfoText,
      meta,
      prefix,
    );
  }

  // NOT OK => We found some vulns, let's format the vulns info

  return getDisplayedOutput(
    res as TestResult,
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
