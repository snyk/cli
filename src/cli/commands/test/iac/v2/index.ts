import chalk from 'chalk';
import { TestCommandResult } from '../../../types';
import { RulesBundleLocator } from './rules';
import config from '../../../../../lib/config';
import envPaths from 'env-paths';
import * as path from 'path';

export async function test(): Promise<TestCommandResult> {
  const bundleLocator = createRulesBundleLocator();
  const bundlePath = bundleLocator.locateBundle();

  if (bundlePath) {
    console.log(`found rules bundle at ${bundlePath}`);
  } else {
    console.log('no rules bundle found');
  }

  let response = '';
  response += chalk.bold.green('new flow for UPE integration - TBC...');
  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    '',
    '',
  );
}

function createRulesBundleLocator(): RulesBundleLocator {
  const systemCachePath = config.CACHE_PATH ?? envPaths('snyk').cache;
  const cachedBundlePath = path.join(systemCachePath, 'iac', 'bundle.tar.gz');
  const userBundlePath = config.IAC_BUNDLE_PATH;
  return new RulesBundleLocator(cachedBundlePath, userBundlePath);
}
