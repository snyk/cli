import * as pathLib from 'path';
import * as cloneDeep from 'lodash.clonedeep';

import * as lookupLocalLib from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/test-engine/lookup-local';
import * as downloadLib from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/test-engine/download';
import { initTestEngine } from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/test-engine';

jest.mock(
  '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/test-engine/constants',
  () => ({
    testEngineFileName: 'test-test-engine-file-name',
  }),
);

describe('initTestEngine', () => {
  const testIacCachePath = pathLib.join('test', 'iac', 'cache', 'path');
  const defaultTestTestConfig = {
    iacCachePath: testIacCachePath,
  };
  const testTestEngineFileName = 'test-test-engine-file-name';
  const testCachedTestEnginePath = pathLib.join(
    testIacCachePath,
    testTestEngineFileName,
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('looks up the Test Engine executable locally', async () => {
    // Arrange
    const testTestConfig = cloneDeep(defaultTestTestConfig);

    const lookupLocalSpy = jest
      .spyOn(lookupLocalLib, 'lookupLocalTestEngine')
      .mockResolvedValue(testCachedTestEnginePath);
    jest
      .spyOn(downloadLib, 'downloadTestEngine')
      .mockResolvedValue(testCachedTestEnginePath);

    // Act
    await initTestEngine(testTestConfig);

    // Assert
    expect(lookupLocalSpy).toHaveBeenCalledWith(testTestConfig);
  });

  describe('when a valid local Test Engine executable is found', () => {
    it('returns the local Test Engine executable path', async () => {
      // Arrange
      const testTestConfig = cloneDeep(defaultTestTestConfig);

      jest
        .spyOn(lookupLocalLib, 'lookupLocalTestEngine')
        .mockResolvedValue(testCachedTestEnginePath);
      jest
        .spyOn(downloadLib, 'downloadTestEngine')
        .mockResolvedValue(testCachedTestEnginePath);

      // Act
      const res = await initTestEngine(testTestConfig);

      // Assert
      expect(res).toEqual(testCachedTestEnginePath);
    });

    it('does not download the Test Engine executable', async () => {
      // Arrange
      const testTestConfig = cloneDeep(defaultTestTestConfig);

      jest
        .spyOn(lookupLocalLib, 'lookupLocalTestEngine')
        .mockResolvedValue(testCachedTestEnginePath);
      const downloadSpy = jest
        .spyOn(downloadLib, 'downloadTestEngine')
        .mockResolvedValue(testCachedTestEnginePath);

      // Act
      await initTestEngine(testTestConfig);

      // Assert
      expect(downloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('when no valid local Test Engine executable is found', () => {
    it('downloads the Test Engine executable', async () => {
      // Arrange
      const testTestConfig = cloneDeep(defaultTestTestConfig);

      jest
        .spyOn(lookupLocalLib, 'lookupLocalTestEngine')
        .mockResolvedValue(undefined);
      const downloadSpy = jest
        .spyOn(downloadLib, 'downloadTestEngine')
        .mockResolvedValue(testCachedTestEnginePath);

      // Act
      await initTestEngine(testTestConfig);

      // Assert
      expect(downloadSpy).toHaveBeenCalledWith(testTestConfig);
    });

    it('returns the path to the downloaded Test Engine executable', async () => {
      // Arrange
      const testTestConfig = cloneDeep(defaultTestTestConfig);

      jest
        .spyOn(lookupLocalLib, 'lookupLocalTestEngine')
        .mockResolvedValue(undefined);
      jest
        .spyOn(downloadLib, 'downloadTestEngine')
        .mockResolvedValue(testCachedTestEnginePath);

      // Act
      const res = await initTestEngine(testTestConfig);

      // Assert
      expect(res).toEqual(testCachedTestEnginePath);
    });
  });
});
