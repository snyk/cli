import * as pathLib from 'path';
import * as cloneDeep from 'lodash.clonedeep';
import {
  InvalidUserPathError,
  lookupLocal,
} from '../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/utils';

describe('lookupLocal', () => {
  const iacCachePath = pathLib.join('iac', 'cache', 'path');
  const defaultTestConfig = {
    iacCachePath,
  };
  const cachedRulesBundlePath = pathLib.join(iacCachePath, 'resourceName');

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when a user configured path for a rules bundle is not provided', () => {
    describe('when the Rules Bundle was cached', () => {
      it('returns the path to the cached Rules Bundle', async () => {
        // Arrange
        const testConfig = cloneDeep(defaultTestConfig);

        // Act
        const res = await lookupLocal(
          testConfig.iacCachePath,
          'resourceName',
          undefined,
          async () => true,
        );

        // Assert
        expect(res).toEqual(cachedRulesBundlePath);
      });
    });

    describe('when the Rules Bundle was not cached', () => {
      it('returns no path', async () => {
        // Arrange
        const testConfig = cloneDeep(defaultTestConfig);

        // Act
        const res = await lookupLocal(
          testConfig.iacCachePath,
          'resourceName',
          undefined,
          async () => false,
        );

        // Assert
        expect(res).toBeUndefined();
      });
    });
  });

  describe('when a user configured path for a rules bundle is provided', () => {
    const userResourcePath = 'user/configured/resource/path';

    describe('when the user configured path points to a valid Rules Bundle', () => {
      it('returns the user configured path', async () => {
        // Arrange
        const testConfig = {
          ...cloneDeep(defaultTestConfig),
          userResourcePath,
        };

        // Act
        const res = await lookupLocal(
          testConfig.iacCachePath,
          'resourceName',
          testConfig.userResourcePath,
          async () => true,
        );

        // Assert
        expect(res).toEqual(userResourcePath);
      });
    });

    describe('when the user configured path does not point to a valid Rules Bundle', () => {
      it('throws an error', async () => {
        // Arrange
        const testConfig = {
          ...cloneDeep(defaultTestConfig),
          userResourcePath,
        };

        // Act + Assert
        await expect(
          lookupLocal(
            testConfig.iacCachePath,
            'resourceName',
            testConfig.userResourcePath,
            async () => false,
          ),
        ).rejects.toThrow(InvalidUserPathError);
      });
    });
  });
});
