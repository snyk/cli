import * as pathLib from 'path';
import * as cloneDeep from 'lodash.clonedeep';
import * as fileUtils from '../../../../../../../../../../src/lib/iac/file-utils';
import {
  InvalidUserRulesBundlePathError,
  lookupLocalRulesBundle,
} from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/rules-bundle/lookup-local';
import { rulesBundleName } from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/rules-bundle/constants';
import * as utilsLib from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/utils';
import { InvalidUserPathError } from '../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/utils';

describe('lookupLocalRulesBundle', () => {
  const iacCachePath = pathLib.join('iac', 'cache', 'path');
  const defaultTestConfig = {
    iacCachePath,
  };
  const cachedRulesBundlePath = pathLib.join(iacCachePath, rulesBundleName);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls `lookupLocal` with the appropriate condition', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    const lookupLocalySpy = jest.spyOn(utilsLib, 'lookupLocal');
    const isFileSpy = jest
      .spyOn(fileUtils, 'isFile')
      .mockImplementation(async (_path) => _path === cachedRulesBundlePath);
    const isArchiveSpy = jest
      .spyOn(fileUtils, 'isArchive')
      .mockImplementation(async (_path) => _path === cachedRulesBundlePath);

    // Act
    await lookupLocalRulesBundle(testConfig);

    // Assert
    expect(lookupLocalySpy).toBeCalledWith(
      testConfig.iacCachePath,
      rulesBundleName,
      undefined,
      expect.any(Function),
    );
    expect(isFileSpy).toBeCalledWith(cachedRulesBundlePath);
    expect(isArchiveSpy).toBeCalledWith(cachedRulesBundlePath);
  });

  it('returns undefined when the rules bundle is not present locally', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    jest.spyOn(utilsLib, 'lookupLocal').mockResolvedValue(undefined);

    // Act
    const res = await lookupLocalRulesBundle(testConfig);

    // Assert
    expect(res).toEqual(undefined);
  });

  it('return the path to the rules bundle when it is present locally', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    jest
      .spyOn(utilsLib, 'lookupLocal')
      .mockResolvedValue(cachedRulesBundlePath);

    // Act
    const res = await lookupLocalRulesBundle(testConfig);

    // Assert
    expect(res).toEqual(cachedRulesBundlePath);
  });

  it('return an error when the condition is not met', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    jest
      .spyOn(utilsLib, 'lookupLocal')
      .mockRejectedValue(new InvalidUserPathError('test error'));

    // Act + Assert
    await expect(lookupLocalRulesBundle(testConfig)).rejects.toThrow(
      InvalidUserRulesBundlePathError,
    );
  });
});
