import { hasFeatureFlag } from '../../../../../src/lib/feature-flags';
import * as request from '../../../../../src/lib/request';

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
