import * as pathLib from 'path';
import * as cloneDeep from 'lodash.clonedeep';

import * as lookupLocalLib from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine/lookup-local';
import * as downloadLib from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine/download';
import { initPolicyEngine } from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine';

jest.mock(
  '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine/constants',
  () => ({
    policyEngineFileName: 'test-policy-engine-file-name',
  }),
);

describe('initPolicyEngine', () => {
  const testIacCachePath = pathLib.join('test', 'iac', 'cache', 'path');
  const defaultTestTestConfig = {
    iacCachePath: testIacCachePath,
  };
  const testPolicyEngineFileName = 'test-policy-engine-file-name';
  const testCachedPolicyEnginePath = pathLib.join(
    testIacCachePath,
    testPolicyEngineFileName,
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('looks up the Policy Engine executable locally', async () => {
    // Arrange
    const testTestConfig = cloneDeep(defaultTestTestConfig);

    const lookupLocalSpy = jest
      .spyOn(lookupLocalLib, 'lookupLocalPolicyEngine')
      .mockResolvedValue(testCachedPolicyEnginePath);
    jest
      .spyOn(downloadLib, 'downloadPolicyEngine')
      .mockResolvedValue(testCachedPolicyEnginePath);

    // Act
    await initPolicyEngine(testTestConfig);

    // Assert
    expect(lookupLocalSpy).toHaveBeenCalledWith(testTestConfig);
  });

  describe('when a valid local Policy Engine executable is found', () => {
    it('returns the local Policy Engine executable path', async () => {
      // Arrange
      const testTestConfig = cloneDeep(defaultTestTestConfig);

      jest
        .spyOn(lookupLocalLib, 'lookupLocalPolicyEngine')
        .mockResolvedValue(testCachedPolicyEnginePath);
      jest
        .spyOn(downloadLib, 'downloadPolicyEngine')
        .mockResolvedValue(testCachedPolicyEnginePath);

      // Act
      const res = await initPolicyEngine(testTestConfig);

      // Assert
      expect(res).toEqual(testCachedPolicyEnginePath);
    });

    it('does not download the Policy Engine executable', async () => {
      // Arrange
      const testTestConfig = cloneDeep(defaultTestTestConfig);

      jest
        .spyOn(lookupLocalLib, 'lookupLocalPolicyEngine')
        .mockResolvedValue(testCachedPolicyEnginePath);
      const downloadSpy = jest
        .spyOn(downloadLib, 'downloadPolicyEngine')
        .mockResolvedValue(testCachedPolicyEnginePath);

      // Act
      await initPolicyEngine(testTestConfig);

      // Assert
      expect(downloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('when no valid local Policy Engine executable is found', () => {
    it('downloads the Policy Engine executable', async () => {
      // Arrange
      const testTestConfig = cloneDeep(defaultTestTestConfig);

      jest
        .spyOn(lookupLocalLib, 'lookupLocalPolicyEngine')
        .mockResolvedValue(undefined);
      const downloadSpy = jest
        .spyOn(downloadLib, 'downloadPolicyEngine')
        .mockResolvedValue(testCachedPolicyEnginePath);

      // Act
      await initPolicyEngine(testTestConfig);

      // Assert
      expect(downloadSpy).toHaveBeenCalledWith(testTestConfig);
    });

    it('returns the path to the downloaded Policy Engine executable', async () => {
      // Arrange
      const testTestConfig = cloneDeep(defaultTestTestConfig);

      jest
        .spyOn(lookupLocalLib, 'lookupLocalPolicyEngine')
        .mockResolvedValue(undefined);
      jest
        .spyOn(downloadLib, 'downloadPolicyEngine')
        .mockResolvedValue(testCachedPolicyEnginePath);

      // Act
      const res = await initPolicyEngine(testTestConfig);

      // Assert
      expect(res).toEqual(testCachedPolicyEnginePath);
    });
  });
});
