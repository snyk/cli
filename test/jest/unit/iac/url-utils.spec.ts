import { isValidUrl } from '../../../../src/cli/commands/test/iac/local-execution/url-utils';

describe('url-utils.ts', function() {
  describe('isValidUrl', function() {
    describe('Given a valid URL', function() {
      describe('With a protocol - it returns true', function() {
        it.each([
          'https://valid.io/url',
          'https://valid.io/url:latest',
          'https://valid.io/url:0.1.0',
        ])('%s', function(urlStr) {
          // Act
          const result = isValidUrl(urlStr);

          // Assert
          expect(result).toBe(true);
        });
      });

      describe('Without a protocol - it returns true', function() {
        it.each(['valid.io/url', 'valid.io/url:latest', 'valid.io/url:0.1.0'])(
          '%s',
          function(urlStr) {
            // Act
            const result = isValidUrl(urlStr);

            // Assert
            expect(result).toBe(true);
          },
        );
      });
    });

    describe('When given an invalid URL', function() {
      describe('With a protocol - it returns false', function() {
        it.each([
          'http://an/invalid/url',
          'https://an-invalid-url',
          'http://:an_invalid/url',
        ])('%s', function(urlStr: string) {
          const result = isValidUrl(urlStr);

          // Assert
          expect(result).toBe(false);
        });
      });

      describe('Without a protocol - it returns false', function() {
        it.each(['an/invalid/url', 'an-invalid-url', ':an_invalid/url'])(
          '%s',
          function(urlStr: string) {
            const result = isValidUrl(urlStr);

            // Assert
            expect(result).toBe(false);
          },
        );
      });
    });
  });
});
