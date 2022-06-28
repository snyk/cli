import * as pathLib from 'path';
import * as initTestEngineLib from '../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/test-engine';
import * as initRulesBundleLib from '../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/rules-bundle';
import * as fileUtils from '../../../../../../../../../src/lib/iac/file-utils';
import { initLocalCache } from '../../../../../../../../../src/lib/iac/test/v2/setup/local-cache';
import { TestConfig } from '../../../../../../../../../src/lib/iac/test/v2/types';
import { FailedToInitLocalCacheError } from '../../../../../../../../../src/cli/commands/test/iac/local-execution/local-cache';

describe('initLocalCache', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates the IaC cache directory if it does not exist', async () => {
    // Arrange
    const testTestEnginePath = 'test-test-engine-path';
    const testRulesBundlePath = 'test-rules-bundle-path';
    const testTestConfig = {
      iacCachePath: pathLib.join('iac', 'cache', 'path'),
    } as TestConfig;

    jest
      .spyOn(initTestEngineLib, 'initTestEngine')
      .mockImplementation(async () => testTestEnginePath);
    jest
      .spyOn(initRulesBundleLib, 'initRulesBundle')
      .mockImplementation(async () => testRulesBundlePath);
    const createDirIfNotExistsSpy = jest
      .spyOn(fileUtils, 'createDirIfNotExists')
      .mockImplementation(async () => undefined);

    // Act
    await initLocalCache(testTestConfig);

    // Assert
    expect(createDirIfNotExistsSpy).toHaveBeenCalledWith(
      testTestConfig.iacCachePath,
    );
  });

  it('initializes the Test Engine executable', async () => {
    // Arrange
    const testTestEnginePath = 'test-test-engine-path';
    const testRulesBundlePath = 'test-rules-bundle-path';
    const testTestConfig = {
      iacCachePath: pathLib.join('iac', 'cache', 'path'),
    } as TestConfig;

    const initTestEngineSpy = jest
      .spyOn(initTestEngineLib, 'initTestEngine')
      .mockImplementation(async () => testTestEnginePath);
    jest
      .spyOn(initRulesBundleLib, 'initRulesBundle')
      .mockImplementation(async () => testRulesBundlePath);
    jest
      .spyOn(fileUtils, 'createDirIfNotExists')
      .mockImplementation(async () => undefined);

    // Act
    await initLocalCache(testTestConfig);

    // Assert
    expect(initTestEngineSpy).toHaveBeenCalledWith(testTestConfig);
  });

  it('initializes the rules bundle', async () => {
    // Arrange
    const testTestEnginePath = 'test-test-engine-path';
    const testRulesBundlePath = 'test-rules-bundle-path';
    const testTestConfig = {
      iacCachePath: pathLib.join('iac', 'cache', 'path'),
    } as TestConfig;

    jest
      .spyOn(initTestEngineLib, 'initTestEngine')
      .mockImplementation(async () => testTestEnginePath);
    const initRulesSpy = jest
      .spyOn(initRulesBundleLib, 'initRulesBundle')
      .mockImplementation(async () => testRulesBundlePath);
    jest
      .spyOn(fileUtils, 'createDirIfNotExists')
      .mockImplementation(async () => undefined);

    // Act
    await initLocalCache(testTestConfig);

    // Assert
    expect(initRulesSpy).toHaveBeenCalledWith(testTestConfig);
  });

  it('returns the cached resrouce paths', async () => {
    // Arrange
    const testTestEnginePath = 'test-test-engine-path';
    const testRulesBundlePath = 'test-rules-bundle-path';
    const testTestConfig = {
      iacCachePath: pathLib.join('iac', 'cache', 'path'),
    } as TestConfig;

    jest
      .spyOn(initTestEngineLib, 'initTestEngine')
      .mockImplementation(async () => testTestEnginePath);
    jest
      .spyOn(initRulesBundleLib, 'initRulesBundle')
      .mockImplementation(async () => testRulesBundlePath);
    jest
      .spyOn(fileUtils, 'createDirIfNotExists')
      .mockImplementation(async () => undefined);

    const expected = {
      testEnginePath: testTestEnginePath,
      rulesBundlePath: testRulesBundlePath,
    };
    // Act
    const res = await initLocalCache(testTestConfig);

    // Assert
    expect(res).toStrictEqual(expected);
  });

  describe.each`
    failingResource             | module                | methodName
    ${'cache directory'}        | ${fileUtils}          | ${'createDirIfNotExists'}
    ${'Test Engine executable'} | ${initTestEngineLib}  | ${'initTestEngine'}
    ${'rules bundle'}           | ${initRulesBundleLib} | ${'initRulesBundle'}
  `(
    'when the initialization for the $failingResource fails',
    ({ module, methodName }) => {
      it('throws an error', async () => {
        // Arrange
        const testTestEnginePath = 'test-test-engine-path';
        const testRulesBundlePath = 'test-rules-bundle-path';
        const testTestConfig = {
          iacCachePath: pathLib.join('iac', 'cache', 'path'),
        } as TestConfig;

        jest
          .spyOn(initTestEngineLib, 'initTestEngine')
          .mockImplementation(async () => testTestEnginePath);
        jest
          .spyOn(initRulesBundleLib, 'initRulesBundle')
          .mockImplementation(async () => testRulesBundlePath);
        jest
          .spyOn(fileUtils, 'createDirIfNotExists')
          .mockImplementation(async () => undefined);
        jest.spyOn(module, methodName).mockImplementation(async () => {
          throw new FailedToInitLocalCacheError();
        });

        // Act + Assert
        await expect(initLocalCache(testTestConfig)).rejects.toThrow(
          FailedToInitLocalCacheError,
        );
      });
    },
  );
});
