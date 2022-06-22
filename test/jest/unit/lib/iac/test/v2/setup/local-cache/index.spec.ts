import * as pathLib from 'path';
import * as initPolicyEngineLib from '../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine';
import * as initRulesLib from '../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/rules';
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
    const testPolicyEnginePath = 'test-policy-engine-path';
    const testRulesBundlePath = 'test-rules-bundle-path';
    const testTestConfig = {
      iacCachePath: pathLib.join('iac', 'cache', 'path'),
    } as TestConfig;

    jest
      .spyOn(initPolicyEngineLib, 'initPolicyEngine')
      .mockImplementation(async () => testPolicyEnginePath);
    jest
      .spyOn(initRulesLib, 'initRules')
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

  it('initializes the Policy Engine executable', async () => {
    // Arrange
    const testPolicyEnginePath = 'test-policy-engine-path';
    const testRulesBundlePath = 'test-rules-bundle-path';
    const testTestConfig = {
      iacCachePath: pathLib.join('iac', 'cache', 'path'),
    } as TestConfig;

    const initPolicyEngineSpy = jest
      .spyOn(initPolicyEngineLib, 'initPolicyEngine')
      .mockImplementation(async () => testPolicyEnginePath);
    jest
      .spyOn(initRulesLib, 'initRules')
      .mockImplementation(async () => testRulesBundlePath);
    jest
      .spyOn(fileUtils, 'createDirIfNotExists')
      .mockImplementation(async () => undefined);

    // Act
    await initLocalCache(testTestConfig);

    // Assert
    expect(initPolicyEngineSpy).toHaveBeenCalledWith(testTestConfig);
  });

  it('initializes the rules bundle', async () => {
    // Arrange
    const testPolicyEnginePath = 'test-policy-engine-path';
    const testRulesBundlePath = 'test-rules-bundle-path';
    const testTestConfig = {
      iacCachePath: pathLib.join('iac', 'cache', 'path'),
    } as TestConfig;

    jest
      .spyOn(initPolicyEngineLib, 'initPolicyEngine')
      .mockImplementation(async () => testPolicyEnginePath);
    const initRulesSpy = jest
      .spyOn(initRulesLib, 'initRules')
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
    const testPolicyEnginePath = 'test-policy-engine-path';
    const testRulesBundlePath = 'test-rules-bundle-path';
    const testTestConfig = {
      iacCachePath: pathLib.join('iac', 'cache', 'path'),
    } as TestConfig;

    jest
      .spyOn(initPolicyEngineLib, 'initPolicyEngine')
      .mockImplementation(async () => testPolicyEnginePath);
    jest
      .spyOn(initRulesLib, 'initRules')
      .mockImplementation(async () => testRulesBundlePath);
    jest
      .spyOn(fileUtils, 'createDirIfNotExists')
      .mockImplementation(async () => undefined);

    const expected = {
      policyEnginePath: testPolicyEnginePath,
      rulesBundlePath: testRulesBundlePath,
    };
    // Act
    const res = await initLocalCache(testTestConfig);

    // Assert
    expect(res).toStrictEqual(expected);
  });

  describe.each`
    failingResource               | module                 | methodName
    ${'cache directory'}          | ${fileUtils}           | ${'createDirIfNotExists'}
    ${'Policy Engine executable'} | ${initPolicyEngineLib} | ${'initPolicyEngine'}
    ${'rules bundle'}             | ${initRulesLib}        | ${'initRules'}
  `(
    'when the initialization for the $failingResource fails',
    ({ module, methodName }) => {
      it('throws an error', async () => {
        // Arrange
        const testPolicyEnginePath = 'test-policy-engine-path';
        const testRulesBundlePath = 'test-rules-bundle-path';
        const testTestConfig = {
          iacCachePath: pathLib.join('iac', 'cache', 'path'),
        } as TestConfig;

        jest
          .spyOn(initPolicyEngineLib, 'initPolicyEngine')
          .mockImplementation(async () => testPolicyEnginePath);
        jest
          .spyOn(initRulesLib, 'initRules')
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
