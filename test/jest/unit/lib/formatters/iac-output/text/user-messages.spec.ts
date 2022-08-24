import { shouldLogUserMessages } from '../../../../../../../src/lib/formatters/iac-output/text';

describe('shouldLogUserMessages', () => {
  it.each`
    options                                     | expected
    ${{}}                                       | ${true}
    ${{ json: true }}                           | ${false}
    ${{ sarif: true }}                          | ${false}
    ${{ quiet: true }}                          | ${false}
    ${{ json: true, sarif: true }}              | ${false}
    ${{ json: true, quiet: true }}              | ${false}
    ${{ sarif: true, quiet: true }}             | ${false}
    ${{ json: true, sarif: true, quiet: true }} | ${false}
  `(
    'should return $expected, with options: $options',
    ({ options, expected }) => {
      // Act
      const result = shouldLogUserMessages(options);

      // Assert
      expect(result).toEqual(expected);
    },
  );
});
