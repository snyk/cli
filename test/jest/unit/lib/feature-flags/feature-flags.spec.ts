import {
  hasFeatureFlag,
  isFeatureFlagSupportedForOrg,
} from '../../../../../src/lib/feature-flags';
import * as request from '../../../../../src/lib/request';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('hasFeatureFlag fn', () => {
  it.each`
    hasFlag  | expected
    ${true}  | ${true}
    ${false} | ${false}
  `(
    'should validate that given an org with feature flag $hasFlag as input, hasFeatureFlag returns $expected',
    async ({ hasFlag, expected }) => {
      jest
        .spyOn(request, 'makeRequest')
        .mockResolvedValue({ body: { code: 200, ok: hasFlag } } as any);

      const result = await hasFeatureFlag('test-ff', { path: 'test-path' });
      expect(result).toEqual(expected);
    },
  );

  it('should throw error if there are authentication/authorization failures', async () => {
    jest.spyOn(request, 'makeRequest').mockResolvedValue({
      body: { code: 401, error: 'Unauthorized', ok: false },
    } as any);

    await expect(
      hasFeatureFlag('test-ff', { path: 'test-path' }),
    ).rejects.toThrowError('Unauthorized');

    jest.spyOn(request, 'makeRequest').mockResolvedValue({
      body: { code: 403, error: 'Forbidden', ok: false },
    } as any);
    await expect(
      hasFeatureFlag('test-ff', { path: 'test-path' }),
    ).rejects.toThrowError('Forbidden');
  });
});

describe('isFeatureFlagSupportedForOrg', () => {
  it('should request the given feature flag', async () => {
    const requestSpy = jest.spyOn(request, 'makeRequest').mockResolvedValue({
      body: { code: 401, error: 'Unauthorized', ok: false },
    } as any);

    const { code } = await isFeatureFlagSupportedForOrg(
      'cheeseburgers',
      'org-id',
    );

    expect(code).toBe(401);
    expect(requestSpy).toHaveBeenCalled();
  });

  it('should cache the result for subsequent calls', async () => {
    const requestSpy = jest.spyOn(request, 'makeRequest').mockResolvedValue({
      body: { code: 403, error: 'Forbidden', ok: false },
    } as any);

    await isFeatureFlagSupportedForOrg('cheeseburgers', 'org-id');
    const { code } = await isFeatureFlagSupportedForOrg(
      'cheeseburgers',
      'org-id',
    );

    expect(code).toBe(403);
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });
});
