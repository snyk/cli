import { isExe } from '../../../../file-utils';
import { CustomError } from '../../../../../errors';
import { IaCErrorCodes } from '../../../../../../cli/commands/test/iac/local-execution/types';
import { getErrorStringCode } from '../../../../../../cli/commands/test/iac/local-execution/error-utils';
import { TestConfig } from '../../types';
import { policyEngineFileName } from './constants';
import { InvalidUserPathError, lookupLocal } from '../utils';
import { CLI } from '@snyk/error-catalog-nodejs-public';

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
    this.errorCatalog = new CLI.GeneralIACFailureError('');
  }
}

export async function lookupLocalPolicyEngine(
  testConfig: TestConfig,
): Promise<string | undefined> {
  const validPolicyEngineCondition = async (path: string) => {
    return await isExe(path);
  };

  try {
    return await lookupLocal(
      testConfig.iacCachePath,
      policyEngineFileName,
      testConfig.userPolicyEnginePath,
      validPolicyEngineCondition,
    );
  } catch (err) {
    if (err instanceof InvalidUserPathError) {
      throw new InvalidUserPolicyEnginePathError(
        testConfig.userPolicyEnginePath!, // `lookupLocal` will throw an error only if `userPolicyEnginePath` is configured and invalid
      );
    } else {
      throw err;
    }
  }
}
