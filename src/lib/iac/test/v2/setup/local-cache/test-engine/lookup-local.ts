import { isExe } from '../../../../../file-utils';
import { CustomError } from '../../../../../../errors';
import { IaCErrorCodes } from '../../../../../../../cli/commands/test/iac/local-execution/types';
import { getErrorStringCode } from '../../../../../../../cli/commands/test/iac/local-execution/error-utils';
import { TestConfig } from '../../../types';
import { testEngineFileName } from './constants';
import { InvalidUserPathError, lookupLocal } from '../utils';

export class InvalidUserTestEnginePathError extends CustomError {
  constructor(path: string, message?: string, userMessage?: string) {
    super(
      message ||
        'Failed to find a valid Test Engine executable in the configured path',
    );
    this.code = IaCErrorCodes.InvalidUserTestEnginePathError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      userMessage ||
      `Could not find a valid Test Engine executable in the configured path: ${path}` +
        '\nEnsure the configured path points to a valid Test Engine executable.';
  }
}

export async function lookupLocalTestEngine(
  testConfig: TestConfig,
): Promise<string | undefined> {
  const validTestEngineCondition = async (path: string) => {
    return await isExe(path);
  };

  try {
    return await lookupLocal(
      testConfig.iacCachePath,
      testEngineFileName,
      testConfig.userTestEnginePath,
      validTestEngineCondition,
    );
  } catch (err) {
    if (err instanceof InvalidUserPathError) {
      throw new InvalidUserTestEnginePathError(
        testConfig.userTestEnginePath!, // `lookupLocal` will throw an error only if `userTestEnginePath` is configured and invalid
      );
    } else {
      throw err;
    }
  }
}
