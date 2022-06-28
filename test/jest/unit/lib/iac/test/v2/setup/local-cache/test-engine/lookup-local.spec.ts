import * as pathLib from 'path';
import * as cloneDeep from 'lodash.clonedeep';
import * as fileUtils from '../../../../../../../../../../src/lib/iac/file-utils';
import {
  InvalidUserTestEnginePathError,
  lookupLocalTestEngine,
} from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/test-engine/lookup-local';
import * as utilsLib from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/utils';
import { testEngineFileName } from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/test-engine/constants';
import { InvalidUserPathError } from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/utils';

jest.mock(
  '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/test-engine/constants',
  () => ({
    testEngineFileName: 'test-engine-test-file-name',
  }),
);

describe('lookupLocalTestEngine', () => {
  const iacCachePath = pathLib.join('iac', 'cache', 'path');
  const defaultTestConfig = {
    iacCachePath,
  };
  const cachedTestEnginePath = pathLib.join(
    iacCachePath,
    'test-engine-test-file-name',
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls `lookupLocal` with the appropriate condition', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    const lookupLocalySpy = jest.spyOn(utilsLib, 'lookupLocal');
    const isExeSpy = jest.spyOn(fileUtils, 'isExe');

    // Act
    await lookupLocalTestEngine(testConfig);

    // Assert
    expect(lookupLocalySpy).toBeCalledWith(
      testConfig.iacCachePath,
      testEngineFileName,
      undefined,
      expect.any(Function),
    );
    expect(isExeSpy).toBeCalledWith(cachedTestEnginePath);
  });

  it('returns undefined when the test engine is not present locally', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    jest.spyOn(utilsLib, 'lookupLocal').mockResolvedValue(undefined);

    // Act
    const res = await lookupLocalTestEngine(testConfig);

    // Assert
    expect(res).toEqual(undefined);
  });

  it('return the path to the test engine when it is present locally', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    jest.spyOn(utilsLib, 'lookupLocal').mockResolvedValue(cachedTestEnginePath);

    // Act
    const res = await lookupLocalTestEngine(testConfig);

    // Assert
    expect(res).toEqual(cachedTestEnginePath);
  });

  it('return an error when the condition is not met', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    jest
      .spyOn(utilsLib, 'lookupLocal')
      .mockRejectedValue(new InvalidUserPathError('test error'));

    // Act + Assert
    await expect(lookupLocalTestEngine(testConfig)).rejects.toThrow(
      InvalidUserTestEnginePathError,
    );
  });
});
