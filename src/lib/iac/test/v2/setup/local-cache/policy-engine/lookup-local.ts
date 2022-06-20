import * as pathLib from 'path';
import * as createDebugLogger from 'debug';
import { isExe } from '../../../../../file-utils';
import { CustomError } from '../../../../../../errors';
import { IaCErrorCodes } from '../../../../../../../cli/commands/test/iac/local-execution/types';
import { getErrorStringCode } from '../../../../../../../cli/commands/test/iac/local-execution/error-utils';
import { TestConfig } from '../../../types';
import { policyEngineFileName } from './constants';

const debugLogger = createDebugLogger('snyk-iac');

export class InvalidUserPolicyEnginePathError extends CustomError {
  constructor(path: string, message?: string, userMessage?: string) {
    super(
      message ||
        'Failed to find a valid Policy Engine executable in the configured path',
    );
    this.code = IaCErrorCodes.InvalidUserPolicyEnginePathError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      userMessage ||
      `Could not find a valid Policy Engine executable in the configured path: ${path}` +
        '\nEnsure the configured path points to a valid Policy Engine executable.';
  }
}

export async function lookupLocal({
  iacCachePath,
  userPolicyEnginePath,
}: TestConfig): Promise<string | undefined> {
  // Lookup in custom path.
  if (userPolicyEnginePath) {
    debugLogger(
      'User configured IaC Policy Engine executable path detected: %s',
      userPolicyEnginePath,
    );

    if (await isExe(userPolicyEnginePath)) {
      return userPolicyEnginePath;
    } else {
      throw new InvalidUserPolicyEnginePathError(userPolicyEnginePath);
    }
  }
  // Lookup in cache.
  else {
    const cachedPolicyEnginePath = pathLib.join(
      iacCachePath,
      policyEngineFileName,
    );
    if (await isExe(cachedPolicyEnginePath)) {
      debugLogger(
        'Found cached Policy Engine executable: %s',
        cachedPolicyEnginePath,
      );
      return cachedPolicyEnginePath;
    } else {
      debugLogger(
        'Policy Engine executable was not cached: %s',
        cachedPolicyEnginePath,
      );
    }
  }
}
