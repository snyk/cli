import * as pathLib from 'path';
import * as cloneDeep from 'lodash.clonedeep';

import * as localCacheUtils from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/utils';
import * as fileUtils from '../../../../../../../../../../src/lib/iac/file-utils';
import { TestConfig } from '../../../../../../../../../../src/lib/iac/test/v2/types';
import {
  downloadRulesBundle,
  FailedToDownloadRulesBundleError,
  FailedToCacheRulesBundleError,
  rulesBundleUrl,
} from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/rules-bundle/download';

jest.mock(
  '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/rules-bundle/constants',
  () => ({
    rulesBundleName: 'test-rules-bundle-file-name',
  }),
);

describe('downloadRulesBundle', () => {
  const testIacCachePath = pathLib.join('test', 'iac', 'cache', 'path');
  const defaultTestTestConfig = {
    iacCachePath: testIacCachePath,
  };
  const testRulesBundleFileName = 'test-rules-bundle-file-name';
  const testCachedRulesBundlePath = pathLib.join(
    testIacCachePath,
    testRulesBundleFileName,
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches the rules bundles', async () => {
    // Arrange
    const testTestConfig: TestConfig = cloneDeep(defaultTestTestConfig);
    const testDataBuffer = Buffer.from('test-data-buffer');

    const fetchCacheResourceSpy = jest
      .spyOn(localCacheUtils, 'fetchCacheResource')
      .mockResolvedValue(testDataBuffer);
    jest.spyOn(fileUtils, 'saveFile').mockResolvedValue();

    // Act
    await downloadRulesBundle(testTestConfig);

    // Assert
    expect(fetchCacheResourceSpy).toHaveBeenCalledWith(rulesBundleUrl);
  });

  it('caches the fetched cache resource', async () => {
    // Arrange
    const testTestConfig: TestConfig = cloneDeep(defaultTestTestConfig);
    const testDataBuffer = Buffer.from('test-data-buffer');

    jest
      .spyOn(localCacheUtils, 'fetchCacheResource')
      .mockResolvedValue(testDataBuffer);
    const saveCacheResourceSpy = jest
      .spyOn(fileUtils, 'saveFile')
      .mockResolvedValue();

    // Act
    await downloadRulesBundle(testTestConfig);

    // Assert
    expect(saveCacheResourceSpy).toHaveBeenCalledWith(
      testDataBuffer,
      testCachedRulesBundlePath,
    );
  });

  describe('when the rules bundle fails to be fetched', () => {
    it('throws an error', async () => {
      // Arrange
      const testTestConfig: TestConfig = cloneDeep(defaultTestTestConfig);
      jest
        .spyOn(localCacheUtils, 'fetchCacheResource')
        .mockRejectedValue(new Error());
      jest.spyOn(fileUtils, 'saveFile').mockResolvedValue();

      // Act + Assert
      await expect(downloadRulesBundle(testTestConfig)).rejects.toThrow(
        FailedToDownloadRulesBundleError,
      );
    });
  });

  describe('when the rules bundle fails to be cached', () => {
    it('throws an error', async () => {
      // Arrange
      const testTestConfig: TestConfig = cloneDeep(defaultTestTestConfig);
      const testDataBuffer = Buffer.from('test-data-buffer');

      jest
        .spyOn(localCacheUtils, 'fetchCacheResource')
        .mockResolvedValue(testDataBuffer);
      jest.spyOn(fileUtils, 'saveFile').mockRejectedValue(new Error());

      // Act + Assert
      await expect(downloadRulesBundle(testTestConfig)).rejects.toThrow(
        FailedToCacheRulesBundleError,
      );
    });
  });
});
