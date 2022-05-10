import { shouldLogUserMessages } from '../../../../../../../src/lib/formatters/iac-output';

describe('shouldLogUserMessages', () => {
  it.each`
    iacCliOutputFeatureFlag | options                                     | expected
    ${true}                 | ${{}}                                       | ${true}
    ${true}                 | ${{ json: true }}                           | ${false}
    ${true}                 | ${{ sarif: true }}                          | ${false}
    ${true}                 | ${{ quiet: true }}                          | ${false}
    ${true}                 | ${{ json: true, sarif: true }}              | ${false}
    ${true}                 | ${{ json: true, quiet: true }}              | ${false}
    ${true}                 | ${{ sarif: true, quiet: true }}             | ${false}
    ${true}                 | ${{ json: true, sarif: true, quiet: true }} | ${false}
    ${false}                | ${{}}                                       | ${false}
    ${false}                | ${{ json: true }}                           | ${false}
    ${false}                | ${{ sarif: true }}                          | ${false}
    ${false}                | ${{ quiet: true }}                          | ${false}
    ${false}                | ${{ json: true, sarif: true }}              | ${false}
    ${false}                | ${{ json: true, quiet: true }}              | ${false}
    ${false}                | ${{ sarif: true, quiet: true }}             | ${false}
    ${false}                | ${{ json: true, sarif: true, quiet: true }} | ${false}
  `(
    'should return $expected, with: iacCliOutputFeatureFlag: $iacCliOutputFeatureFlag, options: $options',
    ({ iacCliOutputFeatureFlag, options, expected }) => {
      // Act
      const result = shouldLogUserMessages(options, iacCliOutputFeatureFlag);

      // Assert
      expect(result).toEqual(expected);
    },
  );
});
