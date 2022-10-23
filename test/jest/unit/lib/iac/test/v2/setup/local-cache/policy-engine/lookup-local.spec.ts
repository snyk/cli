import * as pathLib from 'path';
import * as cloneDeep from 'lodash.clonedeep';
import * as fileUtils from '../../../../../../../../../../src/lib/iac/file-utils';
import {
  InvalidUserPolicyEnginePathError,
  lookupLocalPolicyEngine,
} from '../../../../../../../../../../src/lib/iac/test/v2/local-cache/policy-engine/lookup-local';
import * as utilsLib from '../../../../../../../../../../src/lib/iac/test/v2/local-cache/utils';
import { policyEngineFileName } from '../../../../../../../../../../src/lib/iac/test/v2/local-cache/policy-engine/constants';
import { InvalidUserPathError } from '../../../../../../../../../../src/lib/iac/test/v2/local-cache/utils';

jest.mock(
  '../../../../../../../../../../src/lib/iac/test/v2/local-cache/policy-engine/constants',
  () => ({
    policyEngineFileName: 'policy-engine-test-file-name',
  }),
);

describe('lookupLocalPolicyEngine', () => {
  const iacCachePath = pathLib.join('iac', 'cache', 'path');
  const defaultTestConfig = {
    iacCachePath,
  };
  const cachedPolicyEnginePath = pathLib.join(
    iacCachePath,
    'policy-engine-test-file-name',
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls `lookupLocal` with the appropriate condition', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    const lookupLocallySpy = jest.spyOn(utilsLib, 'lookupLocal');
    const isExeSpy = jest.spyOn(fileUtils, 'isExe');

    // Act
    await lookupLocalPolicyEngine(testConfig);

    // Assert
    expect(lookupLocallySpy).toBeCalledWith(
      testConfig.iacCachePath,
      policyEngineFileName,
      undefined,
      expect.any(Function),
    );
    expect(isExeSpy).toBeCalledWith(cachedPolicyEnginePath);
  });

  it('returns undefined when the policy engine is not present locally', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    jest.spyOn(utilsLib, 'lookupLocal').mockResolvedValue(undefined);

    // Act
    const res = await lookupLocalPolicyEngine(testConfig);

    // Assert
    expect(res).toEqual(undefined);
  });

  it('return the path to the policy engine when it is present locally', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    jest
      .spyOn(utilsLib, 'lookupLocal')
      .mockResolvedValue(cachedPolicyEnginePath);

    // Act
    const res = await lookupLocalPolicyEngine(testConfig);

    // Assert
    expect(res).toEqual(cachedPolicyEnginePath);
  });

  it('return an error when the condition is not met', async () => {
    // Arrange
    const testConfig = cloneDeep(defaultTestConfig);

    jest
      .spyOn(utilsLib, 'lookupLocal')
      .mockRejectedValue(new InvalidUserPathError('test error'));

    // Act + Assert
    await expect(lookupLocalPolicyEngine(testConfig)).rejects.toThrow(
      InvalidUserPolicyEnginePathError,
    );
  });
});
