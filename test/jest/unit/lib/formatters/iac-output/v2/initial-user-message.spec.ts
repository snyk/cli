import { shouldPrintIacInitialMessage } from '../../../../../../../src/lib/formatters/iac-output';

describe('shouldPrintIacInitialMessage', () => {
  describe("when the 'iacCliOutputFeatureFlag' flag is provided and the 'json' and 'sarif' options are not provided", () => {
    it('should return true', () => {
      // Arrange
      const testOptions = {};
      const testIacCliOutputFeatureFlag = true;

      // Act
      const result = shouldPrintIacInitialMessage(
        testOptions,
        testIacCliOutputFeatureFlag,
      );

      // Assert
      expect(result).toEqual(true);
    });
  });

  describe.each`
    option
    ${'json'}
    ${'sarif'}
  `("when the '$option' option is provided", ({ option }) => {
    it('should return false', () => {
      // Arrange
      const testOptions = { [option]: true };
      const testIacCliOutputFeatureFlag = true;

      // Act
      const result = shouldPrintIacInitialMessage(
        testOptions,
        testIacCliOutputFeatureFlag,
      );

      // Assert
      expect(result).toEqual(false);
    });
  });

  describe("when the 'iacCliOutputFeatureFlag' flag is not provided", () => {
    it('should return false', () => {
      // Arrange
      const testOptions = {};

      // Act
      const result = shouldPrintIacInitialMessage(testOptions);

      // Assert
      expect(result).toEqual(false);
    });
  });
});
