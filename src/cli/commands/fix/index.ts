import * as Debug from 'debug';
import * as snykFix from '@snyk/fix';
import * as ora from 'ora';

import { MethodArgs } from '../../args';
import * as snyk from '../../../lib';
import { TestResult } from '../../../lib/snyk-test/legacy';
import * as analytics from '../../../lib/analytics';

import { convertLegacyTestResultToFixEntities } from './convert-legacy-tests-results-to-fix-entities';
import { formatTestError } from '../test/format-test-error';
import { processCommandArgs } from '../process-command-args';
import { validateCredentials } from '../test/validate-credentials';
import { validateTestOptions } from '../test/validate-test-options';
import { setDefaultTestOptions } from '../test/set-default-test-options';
import { validateFixCommandIsSupported } from './validate-fix-command-is-supported';
import { Options, TestOptions } from '../../../lib/types';
import { getDisplayPath } from './get-display-path';
import chalk from 'chalk';
import { icon, color } from '../../../lib/theme';

const debug = Debug('snyk-fix');
const snykFixFeatureFlag = 'cliSnykFix';

interface FixOptions {
  dryRun?: boolean;
  quiet?: boolean;
  sequential?: boolean;
}
export default async function fix(...args: MethodArgs): Promise<string> {
  const { options: rawOptions, paths } = await processCommandArgs<FixOptions>(
    ...args,
  );
  const options = setDefaultTestOptions<FixOptions>(rawOptions);
  debug(options);
  await validateFixCommandIsSupported(options);
  validateTestOptions(options);
  validateCredentials(options);
  const results: snykFix.EntityToFix[] = [];
  results.push(...(await runSnykTestLegacy(options, paths)));
  // fix
  debug(
    `Organization has ${snykFixFeatureFlag} feature flag enabled for experimental Snyk fix functionality`,
  );
  const vulnerableResults = results.filter(
    (res) => Object.keys(res.testResult.issues).length,
  );
  const { dryRun, quiet, sequential: sequentialFix } = options;
  const { fixSummary, meta, results: resultsByPlugin } = await snykFix.fix(
    results,
    {
      dryRun,
      quiet,
      sequentialFix,
    },
  );

  setSnykFixAnalytics(
    fixSummary,
    meta,
    results,
    resultsByPlugin,
    vulnerableResults,
  );
  // `snyk test` did not return any test results
  if (results.length === 0) {
    throw new Error(fixSummary);
  }
  // `snyk test` returned no vulnerable results, so nothing to fix
  if (vulnerableResults.length === 0) {
    return fixSummary;
  }
  // `snyk test` returned vulnerable results
  // however some errors occurred during `snyk fix` and nothing was fixed in the end
  const anyFailed = meta.failed > 0;
  const noneFixed = meta.fixed === 0;
  if (anyFailed && noneFixed) {
    throw new Error(fixSummary);
  }
  return fixSummary;
}

/* @deprecated
 * TODO: once project envelope is default all code below will be deleted
 * we should be calling test via new Ecosystems instead
 */
async function runSnykTestLegacy(
  options: Options & TestOptions & FixOptions,
  paths: string[],
): Promise<snykFix.EntityToFix[]> {
  const results: snykFix.EntityToFix[] = [];
  const stdOutSpinner = ora({
    isSilent: options.quiet,
    stream: process.stdout,
  });
  const stdErrSpinner = ora({
    isSilent: options.quiet,
    stream: process.stdout,
  });
  stdErrSpinner.start();
  stdOutSpinner.start();

  for (const path of paths) {
    let displayPath = path;
    const spinnerMessage = `Running \`snyk test\` for ${displayPath}`;

    try {
      displayPath = getDisplayPath(path);
      stdOutSpinner.text = spinnerMessage;
      stdOutSpinner.render();
      // Create a copy of the options so a specific test can
      // modify them i.e. add `options.file` etc. We'll need
      // these options later.
      const snykTestOptions = {
        ...options,
        path,
        projectName: options['project-name'],
      };

      const testResults: TestResult[] = [];

      const testResultForPath: TestResult | TestResult[] = await snyk.test(
        path,
        { ...snykTestOptions, quiet: true },
      );
      testResults.push(
        ...(Array.isArray(testResultForPath)
          ? testResultForPath
          : [testResultForPath]),
      );
      const newRes = convertLegacyTestResultToFixEntities(
        testResults,
        path,
        options,
      );
      results.push(...newRes);
      stdOutSpinner.stopAndPersist({
        text: spinnerMessage,
        symbol: `\n${icon.RUN}`,
      });
    } catch (error) {
      const testError = formatTestError(error);
      const userMessage =
        color.status.error(`Failed! ${testError.message}.`) +
        `\n  Tip: run \`snyk test ${displayPath} -d\` for more information.`;
      stdOutSpinner.stopAndPersist({
        text: spinnerMessage,
        symbol: `\n${icon.RUN}`,
      });
      stdErrSpinner.stopAndPersist({
        text: userMessage,
        symbol: chalk.red(' '),
      });
      debug(userMessage);
    }
  }
  stdOutSpinner.stop();
  stdErrSpinner.stop();
  return results;
}

function setSnykFixAnalytics(
  fixSummary: string,
  meta: snykFix.FixedMeta,
  snykTestResponses: snykFix.EntityToFix[],
  resultsByPlugin: snykFix.FixHandlerResultByPlugin,
  vulnerableResults: snykFix.EntityToFix[],
) {
  // Analytics # of projects
  analytics.add('snykFixFailedProjects', meta.failed);
  analytics.add('snykFixFixedProjects', meta.fixed);
  analytics.add('snykFixTotalProjects', snykTestResponses.length);
  analytics.add('snykFixVulnerableProjects', vulnerableResults.length);

  // Analytics # of issues
  analytics.add('snykFixFixableIssues', meta.fixableIssues);
  analytics.add('snykFixFixedIssues', meta.fixedIssues);
  analytics.add('snykFixTotalIssues', meta.totalIssues);

  analytics.add('snykFixSummary', fixSummary);

  // Analytics for errors
  for (const plugin of Object.keys(resultsByPlugin)) {
    const errors: string[] = [];
    const failedToFix = resultsByPlugin[plugin].failed;
    if (failedToFix.length > 0) {
      errors.push(...failedToFix.map((f) => f.error?.message));
    }
    analytics.add('snykFixErrors', { [plugin]: errors });
  }
}
