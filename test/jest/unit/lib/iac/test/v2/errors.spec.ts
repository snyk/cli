import { getErrorUserMessage } from '../../../../../../../src/lib/iac/test/v2/errors';

describe('getErrorUserMessage', () => {
  it('returns INVALID_SNYK_IAC_TEST_ERROR for an invalid snyk-iac-test error code', () => {
    expect(getErrorUserMessage(0, '')).toEqual('INVALID_SNYK_IAC_TEST_ERROR');
    expect(getErrorUserMessage(3000, '')).toEqual(
      'INVALID_SNYK_IAC_TEST_ERROR',
    );
  });

  it('returns INVALID_IAC_ERROR for an invalid error code', () => {
    expect(getErrorUserMessage(2999, '')).toEqual('INVALID_IAC_ERROR');
  });

  it.each`
    expectedErrorCode
    ${2000}
    ${2003}
    ${2004}
    ${2005}
    ${2100}
    ${2101}
    ${2102}
    ${2103}
    ${2104}
    ${2105}
    ${2106}
    ${2107}
    ${2108}
    ${2109}
    ${2110}
    ${2111}
    ${2112}
    ${2113}
    ${2114}
  `(
    'returns a user message for a valid snyk-iac-test error code - $expectedErrorCode',
    ({ expectedErrorCode }) => {
      expect(typeof getErrorUserMessage(expectedErrorCode, '')).toBe('string');
    },
  );
});
