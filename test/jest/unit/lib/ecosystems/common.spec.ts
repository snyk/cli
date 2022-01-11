import { isUnmanagedEcosystem } from '../../../../../src/lib/ecosystems/common';

describe('isUnmanagedEcosystem fn', () => {
  it.each`
    actual      | expected
    ${'cpp'}    | ${true}
    ${'docker'} | ${false}
    ${'code'}   | ${false}
  `(
    'should validate that given $actual as input, is considered or not an unmanaged ecosystem',
    ({ actual, expected }) => {
      expect(isUnmanagedEcosystem(actual)).toEqual(expected);
    },
  );
});
