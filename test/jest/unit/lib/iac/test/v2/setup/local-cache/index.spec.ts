import * as pathLib from 'path';
import * as initPolicyEngineLib from '../../../../../../../../../src/lib/iac/test/v2/local-cache/policy-engine';
import * as fileUtils from '../../../../../../../../../src/lib/iac/file-utils';
import { initLocalCache } from '../../../../../../../../../src/lib/iac/test/v2/local-cache';
import { TestConfig } from '../../../../../../../../../src/lib/iac/test/v2/types';
import { FailedToInitLocalCacheError } from '../../../../../../../../../src/cli/commands/test/iac/local-execution/local-cache';

describe('initLocalCache', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates the IaC cache directory if it does not exist', async () => {
    const testPolicyEnginePath = 'test-policy-engine-path';
    const testTestConfig = {
      iacCachePath: pathLib.join('iac', 'cache', 'path'),
    } as TestConfig;

    jest
      .spyOn(initPolicyEngineLib, 'initPolicyEngine')
      .mockImplementation(async () => testPolicyEnginePath);
    const createDirIfNotExistsSpy = jest
      .spyOn(fileUtils, 'createDirIfNotExists')
      .mockImplementation(async () => undefined);

    await initLocalCache(testTestConfig);

    expect(createDirIfNotExistsSpy).toHaveBeenCalledWith(
      testTestConfig.iacCachePath,
    );
  });

  it('initializes the Policy Engine executable', async () => {
    const testPolicyEnginePath = 'test-policy-engine-path';
    const testTestConfig = {
      iacCachePath: pathLib.join('iac', 'cache', 'path'),
    } as TestConfig;

    const initPolicyEngineSpy = jest
      .spyOn(initPolicyEngineLib, 'initPolicyEngine')
      .mockImplementation(async () => testPolicyEnginePath);
    jest
      .spyOn(fileUtils, 'createDirIfNotExists')
      .mockImplementation(async () => undefined);

    await initLocalCache(testTestConfig);

    expect(initPolicyEngineSpy).toHaveBeenCalledWith(testTestConfig);
  });

  it('returns the cached resource paths', async () => {
    const testPolicyEnginePath = 'test-policy-engine-path';
    const testTestConfig = {
      iacCachePath: pathLib.join('iac', 'cache', 'path'),
    } as TestConfig;

    jest
      .spyOn(initPolicyEngineLib, 'initPolicyEngine')
      .mockImplementation(async () => testPolicyEnginePath);
    jest
      .spyOn(fileUtils, 'createDirIfNotExists')
      .mockImplementation(async () => undefined);

    const expected = {
      policyEnginePath: testPolicyEnginePath,
      rulesBundlePath: '',
      rulesClientURL: '',
    };
    const res = await initLocalCache(testTestConfig);

    expect(res).toStrictEqual(expected);
  });

  describe.each`
    failingResource               | module                 | methodName
    ${'cache directory'}          | ${fileUtils}           | ${'createDirIfNotExists'}
    ${'Policy Engine executable'} | ${initPolicyEngineLib} | ${'initPolicyEngine'}
  `(
    'when the initialization for the $failingResource fails',
    ({ module, methodName }) => {
      it('throws an error', async () => {
        const testPolicyEnginePath = 'test-policy-engine-path';
        const testTestConfig = {
          iacCachePath: pathLib.join('iac', 'cache', 'path'),
        } as TestConfig;

        jest
          .spyOn(initPolicyEngineLib, 'initPolicyEngine')
          .mockImplementation(async () => testPolicyEnginePath);
        jest
          .spyOn(fileUtils, 'createDirIfNotExists')
          .mockImplementation(async () => undefined);
        jest.spyOn(module, methodName).mockImplementation(async () => {
          throw new FailedToInitLocalCacheError();
        });

        await expect(initLocalCache(testTestConfig)).rejects.toThrow(
          FailedToInitLocalCacheError,
        );
      });
    },
  );
});
