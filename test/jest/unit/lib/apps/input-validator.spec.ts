import {
  validateAllURL,
  validInput,
  validURL,
} from '../../../../../src/lib/apps/input-validator';

describe('input validation for snyk apps', () => {
  // No unit test for validation uuid as we use built function
  describe('validate url', () => {
    const urlTable = [
      ['https://example.com', true],
      ['https://example.com/callback', true],
      // Demo apps and for testing apps running locally
      ['localhost:3000/callback', true],
      ['localhost:3000/callback,something', true],
      ['localhost:3000', true],
      // enquirer validation return string message when false
      ['#something-wrong.com', '#something-wrong.com is not a valid URL'],
      ['#something-wrong', '#something-wrong is not a valid URL'],
      ['something wrong', 'something wrong is not a valid URL'],
      ['something&wrong.com', 'something&wrong.com is not a valid URL'],
    ];

    it.each(urlTable)("validate individual url '%s'", (url, valid) => {
      expect(validURL(url as string)).toBe(valid);
    });
  });

  describe('validate input', () => {
    it('should return error message for empty input', () => {
      const res = validInput('');
      expect(res).toBe('Please enter something');
    });

    it('should return boolean true for valid input', () => {
      const res = validInput('My Awesome App');
      expect(res).toBe(true);
    });
  });

  describe('validate all url string', () => {
    // Expected that input is a comma separated list of url
    it('should return error message if one or more url invalid', () => {
      const res = validateAllURL(
        'something wrong,#something-wrong,localhost:3000,https://example.com',
      );
      // Contain the invalid url
      expect(res).toContain('something wrong is not a valid URL');
      expect(res).toContain('#something-wrong is not a valid URL');
      // Not to contain valid url
      expect(res).not.toContain('localhost:3000');
      expect(res).not.toContain('https://example.com');
    });

    it('should return true if all url valid', () => {
      const res = validateAllURL('localhost:3000/callback,https://example.com');
      expect(res).toBe(true);
    });
  });
});
