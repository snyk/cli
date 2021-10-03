import { calculatePercentage } from '../../../../src/cli/commands/test/iac-local-execution/math-utils';

describe('Math Utils', function() {
  describe('calculatePercentage', function() {
    it('correctly calculates that 5 is 50% of 10', function() {
      const [relativeValue, totalValue] = [5, 10];
      const expectedResult = 50;

      const result = calculatePercentage(relativeValue, totalValue);

      expect(result).toBe(expectedResult);
    });

    it('correctly calculates that 1 is 4.35% of 23', function() {
      const [relativeValue, totalValue] = [1, 23];
      const expectedResult = 4.35;

      const result = calculatePercentage(relativeValue, totalValue);

      expect(result).toBe(expectedResult);
    });

    it('correctly calculates that 45 is 300% of 15', function() {
      const [relativeValue, totalValue] = [45, 15];
      const expectedResult = 300;

      const result = calculatePercentage(relativeValue, totalValue);

      expect(result).toBe(expectedResult);
    });

    it('returns that 0 is 0% of 1000', function() {
      const [relativeValue, totalValue] = [0, 1000];
      const expectedResult = 0;

      const result = calculatePercentage(relativeValue, totalValue);

      expect(result).toBe(expectedResult);
    });

    it('returns 0% when the total value is 0', function() {
      const [relativeValue, totalValue] = [1000, 0];
      const expectedResult = 0;

      const result = calculatePercentage(relativeValue, totalValue);

      expect(result).toBe(expectedResult);
    });
  });
});
