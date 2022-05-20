import { isUnmanagedEcosystem } from '../../../../../src/lib/ecosystems/common';
import { handleProcessingStatus } from '../../../../../src/lib/polling/common';
import { FailedToRunTestError } from '../../../../../src/lib/errors';

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

describe('handleProcessingStatus fn', () => {
  it.each`
    actual         | expected
    ${'CANCELLED'} | ${'Failed to process the project. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output'}
    ${'ERROR'}     | ${'Failed to process the project. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output'}
  `(
    'should validate that given $actual as input, is considered or not an unmanaged ecosystem',
    ({ actual, expected }) => {
      expect(() => {
        handleProcessingStatus({ status: actual } as any);
      }).toThrowError(new FailedToRunTestError(expected));
    },
  );
});
