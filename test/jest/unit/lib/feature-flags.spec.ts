import * as ff from '../../../../src/lib/feature-flags';
import * as featureFlagsFetch from '../../../../src/lib/feature-flags/fetchFeatureFlag';

describe('feature-flag module', () => {
  it('returns false and does not call the FF API if the fail-fast option is not set', async () => {
    const fetchFeatureFlagSpy = jest.spyOn(
      featureFlagsFetch,
      'fetchFeatureFlag',
    );
    fetchFeatureFlagSpy.mockResolvedValue({
      ok: true,
      userMessage: 'set',
    });

    expect(
      await ff.cliFailFast({
        org: '',
      }),
    ).toBe(false);

    expect(
      await ff.cliFailFast({
        'fail-fast': false,
        org: '',
      }),
    ).toBe(false);

    expect(fetchFeatureFlagSpy).not.toHaveBeenCalled();
  });

  it('feature flag `cliFailFast` will not be re-fetched if cached', async () => {
    const fetchFeatureFlagSpy = jest.spyOn(
      featureFlagsFetch,
      'fetchFeatureFlag',
    );
    fetchFeatureFlagSpy.mockResolvedValue({
      ok: false,
      userMessage: 'not set',
    });

    const cliFailFastValue = await ff.cliFailFast({
      'fail-fast': true,
      org: '',
    });
    expect(cliFailFastValue).toBe(false);
    expect(fetchFeatureFlagSpy).toHaveBeenCalledTimes(1);

    fetchFeatureFlagSpy.mockClear();

    const cliFailFastValueAgain = await ff.cliFailFast({
      'fail-fast': true,
      org: '',
    });
    expect(cliFailFastValueAgain).toBe(false);
    expect(fetchFeatureFlagSpy).toHaveBeenCalledTimes(0);
  });
});
