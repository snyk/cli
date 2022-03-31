import chalk from 'chalk';
import { icon, color } from '../../theme';
import { isCI } from '../../../lib/is-ci';
import {
  Options,
  SupportedProjectTypes,
  TestOptions,
} from '../../../lib/types';
import { isLocalFolder } from '../../../lib/detect';
import { TestResult } from '../../../lib/snyk-test/legacy';
import { IacTestResponse } from '../../../lib/snyk-test/iac-test-result';

import {
  dockerRemediationForDisplay,
  formatTestMeta,
} from '../../../lib/formatters';
import { getIacDisplayedOutput } from '../../../lib/formatters/iac-output';
import {
  IacProjectType,
  IacProjectTypes,
  TEST_SUPPORTED_IAC_PROJECTS,
} from '../../../lib/iac/constants';
import {
  dockerUserCTA,
  getDisplayedOutput,
} from '../../../lib/formatters/test/format-test-results';
import { showMultiScanTip } from '../show-multi-scan-tip';

interface DisplayResultOptions extends Options, TestOptions {
  isNewIacOutputSupported?: boolean;
}

export function displayResult(
  res: TestResult,
  options: DisplayResultOptions,
  foundProjectCount?: number,
) {
  const meta = formatTestMeta(res, options);
  const dockerAdvice = dockerRemediationForDisplay(res);
  const projectType =
    (res.packageManager as SupportedProjectTypes) || options.packageManager;
  const localPackageTest = isLocalFolder(options.path);
  let testingPath = options.path;
  if (options.iac && res.targetFile) {
    testingPath = res.targetFile;
  }
  const prefix = chalk.bold.white('\nTesting ' + testingPath + '...\n\n');

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
    pathOrDepsText += res.targetFile;
  } else {
    pathOrDepsText += options.path;
  }
  const testedInfoText = `Tested ${pathOrDepsText} for known ${issuesText}`;

  const multiProjectTip = showMultiScanTip(
    projectType,
    options,
    foundProjectCount,
  );
  const multiProjAdvice = multiProjectTip ? `\n\n${multiProjectTip}` : '';

  // OK  => no vulns found, return
  if (res.ok && res.vulnerabilities.length === 0) {
    const vulnPathsText = options.showVulnPaths
      ? 'no vulnerable paths found.'
      : 'none were found.';
    const summaryOKText = color.status.success(
      `${icon.VALID} ${testedInfoText}, ${vulnPathsText}`,
    );
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
      options.isNewIacOutputSupported,
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
