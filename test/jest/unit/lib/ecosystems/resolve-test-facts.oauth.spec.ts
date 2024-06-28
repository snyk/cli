const mockMakeRequest = jest.fn();

import { Options } from '../../../../../src/lib/types';
import { MissingApiTokenError } from '../../../../../src/lib/errors';

import { resolveAndTestFacts } from '../../../../../src/lib/ecosystems/resolve-test-facts';

jest.mock('../../../../../src/lib/request/request', () => {
  return {
    makeRequest: mockMakeRequest,
  };
});

describe('oauth failure', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('rethrows same error for missing api token', async () => {
    mockMakeRequest.mockRejectedValue(new MissingApiTokenError());
    await expect(resolveAndTestFacts('cpp', {}, {} as Options)).rejects.toThrow(
      expect.objectContaining({
        message:
          '`snyk` requires an authenticated account. Please run `snyk auth` and try again.',
      }),
    );
  });

  it('rethrows general error for other api auth failures', async () => {
    const err: any = new Error('nope');
    err.code = 403;
    mockMakeRequest.mockRejectedValue(err);
    await expect(resolveAndTestFacts('cpp', {}, {} as Options)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unauthorized request to unmanaged service',
      }),
    );
  });
});
