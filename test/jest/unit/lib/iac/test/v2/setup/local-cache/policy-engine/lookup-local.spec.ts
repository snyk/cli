import * as pathLib from 'path';
import * as cloneDeep from 'lodash.clonedeep';
import * as fileUtils from '../../../../../../../../../../src/lib/iac/file-utils';
import {
  InvalidUserPolicyEnginePathError,
  lookupLocal,
} from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine/lookup-local';

jest.mock(
  '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine/constants',
  () => ({
    policyEngineFileName: 'policy-engine-test-file-name',
  }),
);

describe('lookupLocal', () => {
  const iacCachePath = pathLib.join('iac', 'cache', 'path');
  const defaultTestConfig = {
    iacCachePath,
  };
  const cachedPolicyEnginePath = pathLib.join(
    iacCachePath,
    'policy-engine-test-file-name',
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when a user configured path for a Policy Engine executable is not provded', () => {
    describe('when the Policy Engine executable was cached', () => {
      it('returns the path to the cached Policy Engine executable', async () => {
        // Arrange
        const testConfig = cloneDeep(defaultTestConfig);

        jest
          .spyOn(fileUtils, 'isExe')
          .mockImplementation(async (path) => path === cachedPolicyEnginePath);

        // Act
        const res = await lookupLocal(testConfig);

        // Assert
        expect(res).toEqual(cachedPolicyEnginePath);
      });
    });

    describe('when the Policy Engine was not cached', () => {
      it('returns no path', async () => {
        // Arrange
        const testConfig = cloneDeep(defaultTestConfig);

        // Act
        const res = await lookupLocal(testConfig);

        // Assert
        expect(res).toBeUndefined();
      });
    });
  });

  describe('when a user configured path for a Policy Engine executable is provded', () => {
    const userPolicyEnginePath = 'user/configured/policy/engine/path';

    describe('when the user configured path points to a valid executable', () => {
      it('returns the user configured path', async () => {
        // Arrange
        const testConfig = {
          ...cloneDeep(defaultTestConfig),
          userPolicyEnginePath,
        };

        jest
          .spyOn(fileUtils, 'isExe')
          .mockImplementation(async (path) => path === userPolicyEnginePath);

        // Act
        const res = await lookupLocal(testConfig);

        // Assert
        expect(res).toEqual(userPolicyEnginePath);
      });
    });

    describe('when the user configured path does not point to a valid executable', () => {
      it('throws an error', async () => {
        // Arrange
        const testConfig = {
          ...cloneDeep(defaultTestConfig),
          userPolicyEnginePath,
        };

        // Act + Assert
        await expect(lookupLocal(testConfig)).rejects.toThrow(
          InvalidUserPolicyEnginePathError,
        );
      });
    });
  });
});
