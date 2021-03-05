export = fix;

import * as Debug from 'debug';
import * as snykFix from '@snyk/fix';

import { MethodArgs } from '../../args';
import * as snyk from '../../../lib';
import { TestResult } from '../../../lib/snyk-test/legacy';

import { convertLegacyTestResultToFixEntities } from './convert-legacy-tests-results-to-fix-entities';
import { formatTestError } from '../test/format-test-error';
import { processCommandArgs } from '../process-command-args';
import { validateCredentials } from '../test/validate-credentials';
import { validateTestOptions } from '../test/validate-test-options';
import { setDefaultTestOptions } from '../test/set-default-test-options';
import { validateFixCommandIsSupported } from './validate-fix-command-is-supported';

const debug = Debug('snyk-fix');
const snykFixFeatureFlag = 'cliSnykFix';

async function fix(...args: MethodArgs): Promise<string> {
  const { options: rawOptions, paths } = await processCommandArgs(...args);
  const options = setDefaultTestOptions(rawOptions);
  await validateFixCommandIsSupported(options);
  validateTestOptions(options);
  validateCredentials(options);

  const results: snykFix.EntityToFix[] = [];

  // TODO: once project envelope is default all code below will be deleted
  for (const path of paths) {
    // Create a copy of the options so a specific test can
    // modify them i.e. add `options.file` etc. We'll need
    // these options later.
    const snykTestOptions = {
      ...options,
      path,
      projectName: options['project-name'],
    };

    let testResults: TestResult | TestResult[];

    try {
      testResults = await snyk.test(path, snykTestOptions);
    } catch (error) {
      const testError = formatTestError(error);
      // TODO: what should be done here?
      console.error(testError);
      throw new Error(error);
    }
    const resArray = Array.isArray(testResults) ? testResults : [testResults];
    const newRes = convertLegacyTestResultToFixEntities(resArray, path);
    results.push(...newRes);
  }

  // fix
  debug(
    `Organization has ${snykFixFeatureFlag} feature flag enabled for experimental Snyk fix functionality`,
  );
  await snykFix.fix(results);
  // TODO: what is being returned if anything?
  return '';
}
