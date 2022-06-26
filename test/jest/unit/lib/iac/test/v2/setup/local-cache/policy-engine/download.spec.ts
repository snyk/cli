import * as crypto from 'crypto';
import * as pathLib from 'path';
import * as cloneDeep from 'lodash.clonedeep';

import * as localCacheUtils from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/utils';
import * as fileUtils from '../../../../../../../../../../src/lib/iac/file-utils';
import { TestConfig } from '../../../../../../../../../../src/lib/iac/test/v2/types';
import {
  downloadPolicyEngine,
  FailedToCachePolicyEngineError,
  FailedToDownloadPolicyEngineError,
  policyEngineChecksum,
  policyEngineUrl,
} from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine/download';

jest.mock(
  '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/policy-engine/constants',
  () => ({
    policyEngineFileName: 'test-policy-engine-file-name',
  }),
);

describe('downloadPolicyEngine', () => {
  const testIacCachePath = pathLib.join('test', 'iac', 'cache', 'path');
  const defaultTestTestConfig = {
    iacCachePath: testIacCachePath,
  };
  const testPolicyEngineFileName = 'test-policy-engine-file-name';
  const testCachedPolicyEnginePath = pathLib.join(
    testIacCachePath,
    testPolicyEngineFileName,
  );

  const defaultHashMock = {
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue(policyEngineChecksum),
  } as any;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches the Policy Engine executable', async () => {
    // Arrange
    const testTestConfig: TestConfig = cloneDeep(defaultTestTestConfig);
    const testDataBuffer = Buffer.from('test-data-buffer');

    const fetchCacheResourceSpy = jest
      .spyOn(localCacheUtils, 'fetchCacheResource')
      .mockResolvedValue(testDataBuffer);
    jest.spyOn(crypto, 'createHash').mockReturnValue(defaultHashMock);
    jest.spyOn(fileUtils, 'saveFile').mockResolvedValue();

    // Act
    await downloadPolicyEngine(testTestConfig);

    // Assert
    expect(fetchCacheResourceSpy).toHaveBeenCalledWith(policyEngineUrl);
  });

  it('caches the fetched cache resource', async () => {
    // Arrange
    const testTestConfig: TestConfig = cloneDeep(defaultTestTestConfig);
    const testDataBuffer = Buffer.from('test-data-buffer');

    jest
      .spyOn(localCacheUtils, 'fetchCacheResource')
      .mockResolvedValue(testDataBuffer);
    jest.spyOn(crypto, 'createHash').mockReturnValue(defaultHashMock);
    const saveCacheResourceSpy = jest
      .spyOn(fileUtils, 'saveFile')
      .mockResolvedValue();

    // Act
    await downloadPolicyEngine(testTestConfig);

    // Assert
    expect(saveCacheResourceSpy).toHaveBeenCalledWith(
      testDataBuffer,
      testCachedPolicyEnginePath,
    );
  });

  describe('when the Policy Engine executable fails to be fetched', () => {
    it('throws an error', async () => {
      // Arrange
      const testTestConfig: TestConfig = cloneDeep(defaultTestTestConfig);
      jest
        .spyOn(localCacheUtils, 'fetchCacheResource')
        .mockRejectedValue(new Error());
      jest.spyOn(crypto, 'createHash').mockReturnValue(defaultHashMock);
      jest.spyOn(fileUtils, 'saveFile').mockResolvedValue();

      // Act + Assert
      await expect(downloadPolicyEngine(testTestConfig)).rejects.toThrow(
        FailedToDownloadPolicyEngineError,
      );
    });
  });

  describe('when the Policy engine executable has an invalid checksum', () => {
    it('throws an error', async () => {
      // Arrange
      const testTestConfig: TestConfig = cloneDeep(defaultTestTestConfig);
      const testDataBuffer = Buffer.from('test-data-buffer');

      jest
        .spyOn(localCacheUtils, 'fetchCacheResource')
        .mockResolvedValue(testDataBuffer);
      jest.spyOn(crypto, 'createHash').mockReturnValue({
        ...defaultHashMock,
        digest: () => 'test-inconsistent-checksum',
      });
      jest.spyOn(fileUtils, 'saveFile').mockResolvedValue();

      // Act + Assert
      await expect(downloadPolicyEngine(testTestConfig)).rejects.toThrow(
        FailedToDownloadPolicyEngineError,
      );
    });
  });

  describe('when the Policy Engine executable fails to be cached', () => {
    it('throws an error', async () => {
      // Arrange
      const testTestConfig: TestConfig = cloneDeep(defaultTestTestConfig);
      const testDataBuffer = Buffer.from('test-data-buffer');

      jest
        .spyOn(localCacheUtils, 'fetchCacheResource')
        .mockResolvedValue(testDataBuffer);
      jest.spyOn(crypto, 'createHash').mockReturnValue(defaultHashMock);
      jest.spyOn(fileUtils, 'saveFile').mockRejectedValue(new Error());

      // Act + Assert
      await expect(downloadPolicyEngine(testTestConfig)).rejects.toThrow(
        FailedToCachePolicyEngineError,
      );
    });
  });
});
