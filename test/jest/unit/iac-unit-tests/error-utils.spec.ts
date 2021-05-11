import { getErrorStringCode } from '../../../../src/cli/commands/test/iac-local-execution/error-utils';
import { IaCErrorCodes } from '../../../../src/cli/commands/test/iac-local-execution/types';

describe('getErrorStringCode', () => {
  it('converts invalid IaCErrorCodes error to INVALID_IAC_ERROR', () => {
    expect(getErrorStringCode(10)).toEqual('INVALID_IAC_ERROR');
  });

  it('converts IaCErrorCodes error to UPPER_CASE error string codes', () => {
    expect(
      getErrorStringCode(IaCErrorCodes.FailedToInitLocalCacheError),
    ).toEqual('FAILED_TO_INIT_LOCAL_CACHE_ERROR');
  });
});
