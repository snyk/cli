import * as createDebugLogger from 'debug';
import * as path from 'path';
import { CustomError } from '../../../../../errors';

const debugLogger = createDebugLogger('snyk-iac');

export async function lookupLocal(
  iacCachePath: string,
  resourceName: string,
  userResourcePath: string | undefined,
  validResourceCondition: (path: string) => Promise<boolean>,
): Promise<string | undefined> {
  // Lookup in custom path.
  if (userResourcePath) {
    debugLogger('User configured path detected: %s', userResourcePath);

    if (await validResourceCondition(userResourcePath)) {
      return userResourcePath;
    } else {
      // When using this function please catch this Error and throw a new specific Custom Error.
      throw new InvalidUserPathError(
        `Failed to find a valid resource in the configured path: ${userResourcePath}`,
      );
    }
  }
  // Lookup in cache.
  else {
    const cachedResourcePath = path.join(iacCachePath, resourceName);
    if (await validResourceCondition(cachedResourcePath)) {
      return cachedResourcePath;
    }
  }
}

export class InvalidUserPathError extends CustomError {
  constructor(message: string) {
    super(message);
  }
}
