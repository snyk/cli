import { getBase64Encoding } from '../../../../src/lib/code-config';

describe('test base64 setting', () => {
  test('if not defined, base64 encoding is disabled', () => {
    expect(getBase64Encoding()).toBe(false);
  });

  test('if set to true, base64 encoding is enabled', () => {
    expect(getBase64Encoding('true')).toBe(true);
  });

  test('if set to false, base64 encoding is disabled', () => {
    expect(getBase64Encoding('false')).toBe(false);
  });
});
