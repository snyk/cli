import * as ff from '../../../../src/lib/feature-flags';
import * as featureFlagsFetch from '../../../../src/lib/feature-flags/fetchFeatureFlag';

describe('feature-flag module', () => {
  it('feature flag `cliFailFast` will not be re-fetched if cached', async () => {
    const fetchFeatureFlagSpy = jest.spyOn(
      featureFlagsFetch,
      'fetchFeatureFlag',
    );
    fetchFeatureFlagSpy.mockResolvedValue({
      ok: false,
      userMessage: 'not set',
    });

    const cliFailFastValue = await ff.cliFailFast('');
    expect(cliFailFastValue).toBe(false);
    expect(fetchFeatureFlagSpy).toHaveBeenCalledTimes(1);

    const cliFailFastValueAgain = await ff.cliFailFast('');
    expect(cliFailFastValueAgain).toBe(false);
    // fetchFeatureFlag should still only have been called once - the second call should be a cache hit
    expect(fetchFeatureFlagSpy).toHaveBeenCalledTimes(1);
  });
});
