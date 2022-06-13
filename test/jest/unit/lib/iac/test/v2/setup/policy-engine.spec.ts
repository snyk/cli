import * as cloneDeep from 'lodash.clonedeep';
import * as fileUtils from '../../../../../../../../src/lib/iac/file-utils';
import {
  InvalidUserPolicyEnginePathError,
  lookupLocalPolicyEngine,
} from '../../../../../../../../src/lib/iac/test/v2/setup/policy-engine';

describe('lookupLocalPolicyEngine', () => {
  const defaultTestConfig = {
    cachedPolicyEnginePath: `iac/cache/path/snyk-iac-test`,
  };

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
          .mockImplementationOnce(
            async (path) => path === testConfig.cachedPolicyEnginePath,
          );

        // Act
        const res = await lookupLocalPolicyEngine(testConfig);

        // Assert
        expect(res).toEqual(testConfig.cachedPolicyEnginePath);
      });
    });

    describe('when the Policy Engine was not cached', () => {
      it('returns no path', async () => {
        // Arrange
        const testConfig = cloneDeep(defaultTestConfig);

        // Act
        const res = await lookupLocalPolicyEngine(testConfig);

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
          .mockImplementationOnce(
            async (path) => path === userPolicyEnginePath,
          );

        // Act
        const res = await lookupLocalPolicyEngine(testConfig);

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
        await expect(lookupLocalPolicyEngine(testConfig)).rejects.toThrow(
          InvalidUserPolicyEnginePathError,
        );
      });
    });
  });
});
