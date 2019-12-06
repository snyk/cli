import chalk from 'chalk';
import * as detect from '../detect';
import runTest = require('./run-test');
import * as pm from '../package-managers';
import { UnsupportedPackageManagerError } from '../errors';
import { Options, TestOptions } from '../types';
import { LegacyVulnApiResult } from './legacy';

export = test;

async function test(root: string, options: any) {
  try {
    const packageManager = detect.detectPackageManager(root, options);
    options.packageManager = packageManager;
    const results = await run(root, options);
    for (const res of results) {
      if (!res.packageManager && packageManager) {
        res.packageManager = packageManager;
      }
    }
    if (results.length === 1) {
      // Return only one result if only one found as this is the default usecase
      return results[0];
    }
    // For gradle and yarnWorkspaces we may be returning more than one result
    return results;
  } catch (error) {
    return Promise.reject(chalk.red.bold(error));
  }
}

async function run(root: string, options: Options & TestOptions) {
  const packageManager = options.packageManager;
  if (!(options.docker || pm.SUPPORTED_PACKAGE_MANAGER_NAME[packageManager])) {
    throw new UnsupportedPackageManagerError(packageManager);
  }
  return runTest(packageManager, root, options);
}
