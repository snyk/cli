import { getErrorStringCode } from '../../../../../../../cli/commands/test/iac/local-execution/error-utils';
import { IaCErrorCodes } from '../../../../../../../cli/commands/test/iac/local-execution/types';
import { CustomError } from '../../../../../../errors';
import { isFile, isArchive } from '../../../../../file-utils';
import { InvalidUserPathError, lookupLocal } from '../utils';
import { rulesBundleName } from './constants';

export async function lookupLocalRulesBundle(
  iacCachePath: string,
  userRulesBundlePath: string | undefined,
) {
  const validRulesBundleCondition = async (path: string) => {
    return (await isFile(path)) && (await isArchive(path));
  };

  try {
    return await lookupLocal(
      iacCachePath,
      rulesBundleName,
      userRulesBundlePath,
      validRulesBundleCondition,
    );
  } catch (err) {
    if (err instanceof InvalidUserPathError) {
      throw new InvalidUserRulesBundlePathError(
        userRulesBundlePath!,
        'Failed to find a valid Rules Bundle in the configured path',
      );
    } else {
      throw err;
    }
  }
}

export class InvalidUserRulesBundlePathError extends CustomError {
  constructor(path: string, message: string) {
    super(message);
    this.code = IaCErrorCodes.InvalidUserRulesBundlePathError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `Could not find a valid Rules Bundle in the configured path: ${path}`;
  }
}
