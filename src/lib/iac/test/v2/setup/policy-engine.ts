import * as createDebugLogger from 'debug';
import { isExe } from '../../../file-utils';
import { CustomError } from '../../../../errors';
import { IaCErrorCodes } from '../../../../../cli/commands/test/iac/local-execution/types';
import { getErrorStringCode } from '../../../../../cli/commands/test/iac/local-execution/error-utils';
import { TestConfig } from '../types';

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

export async function lookupLocalPolicyEngine({
  cachedPolicyEnginePath,
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

export async function initPolicyEngine(
  testConfig: TestConfig,
): Promise<string> {
  const localPolicyEnginePath = await lookupLocalPolicyEngine(testConfig);

  if (localPolicyEnginePath) {
    return localPolicyEnginePath;
  }

  // TODO: Download Policy Engine executable

  throw new InvalidUserPolicyEnginePathError('', 'policy engine not found');
}
