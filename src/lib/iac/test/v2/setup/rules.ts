import * as fs from 'fs';
import * as tar from 'tar';
import { CustomError } from '../../../../errors';
import { getErrorStringCode } from '../../../../../cli/commands/test/iac/local-execution/error-utils';
import { IaCErrorCodes } from '../../../../../cli/commands/test/iac/local-execution/types';
import { TestConfig } from '../types';

export async function initRules(testConfig: TestConfig) {
  const bundleLocator = new RulesBundleLocator(
    testConfig.cachedBundlePath,
    testConfig.userBundlePath,
  );
  const bundlePath = bundleLocator.locateBundle();

  if (bundlePath) {
    console.log(`found rules bundle at ${bundlePath}`);
  } else {
    console.log('no rules bundle found');
  }
}

export class RulesBundleLocator {
  constructor(
    private cachedBundlePath: string,
    private userBundlePath?: string,
  ) {}

  locateBundle(): string | null {
    const locatedUserBundle = this.locateUserBundle();

    if (locatedUserBundle) {
      return locatedUserBundle;
    }

    return this.locateCachedBundle();
  }

  private locateUserBundle(): string | null {
    if (!this.userBundlePath) {
      return null;
    }

    if (!fs.existsSync(this.userBundlePath)) {
      return null;
    }

    if (!fs.statSync(this.userBundlePath).isFile()) {
      throw new InvalidUserRulesBundleError('user bundle is not a file');
    }

    if (!isArchive(this.userBundlePath)) {
      throw new InvalidUserRulesBundleError('user bundle is not an archive');
    }

    return this.userBundlePath;
  }

  private locateCachedBundle(): string | null {
    if (!fs.existsSync(this.cachedBundlePath)) {
      return null;
    }

    if (!fs.statSync(this.cachedBundlePath).isFile()) {
      return null;
    }

    if (!isArchive(this.cachedBundlePath)) {
      return null;
    }

    return this.cachedBundlePath;
  }
}

class InvalidUserRulesBundleError extends CustomError {
  constructor(message: string) {
    super(message);
    this.code = IaCErrorCodes.InvalidUserRulesBundleError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `The provided rules bundle is not a valid .tar.gz archive.`;
  }
}

function isArchive(file: string): boolean {
  try {
    tar.list({ file, sync: true, strict: true });
  } catch (e) {
    return false;
  }
  return true;
}
