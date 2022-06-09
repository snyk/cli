import * as fs from 'fs';
import * as tar from 'tar';
import { CustomError } from '../../../../../lib/errors';
import { getErrorStringCode } from '../local-execution/error-utils';
import { IaCErrorCodes } from '../local-execution/types';

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
