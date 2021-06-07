import { hasToDetourToLegacyFlow } from '../../../../../src/lib/ecosystems/enhance-options';
import { Options } from '../../../../../src/lib/types';
import * as featureFlags from '../../../../../src/lib/feature-flags';

describe('enhance-options', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each`
    actualEcosystem | expectedDetour
    ${'docker'}     | ${false}
    ${'code'}       | ${false}
  `(
    'hasCppToDetourFlow - ecosystem `$actualEcosystem` will always have detour set as false even if org has snykLegacyCpp ff',
    async ({ actualEcosystem, expectedDetour }) => {
      const ecosystem = actualEcosystem;
      const options = { org: 'org-with-snyk-legacy-cpp-ff' } as Options;

      const isFeatureFlagSupportedForOrgSpy = jest
        .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
        .mockResolvedValue({
          ok: true,
        });

      const enhancedOptions = {
        ...options,
        detour: await hasToDetourToLegacyFlow(ecosystem, options),
      };

      expect(isFeatureFlagSupportedForOrgSpy).toHaveBeenCalledTimes(0);

      expect(enhancedOptions).toEqual({
        detour: expectedDetour,
        org: 'org-with-snyk-legacy-cpp-ff',
      });
    },
  );

  it('hasCppToDetourFlow - ecosystem `cpp` has detour set as false by default', async () => {
    const ecosystem = 'cpp';
    const options = { org: 'org-without-snyk-legacy-cpp-ff' } as Options;

    const isFeatureFlagSupportedForOrgSpy = jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({
        ok: false,
      });

    const enhancedOptions = {
      ...options,
      detour: await hasToDetourToLegacyFlow(ecosystem, options),
    };

    expect(isFeatureFlagSupportedForOrgSpy).toBeCalledWith(
      'snykLegacyCpp',
      'org-without-snyk-legacy-cpp-ff',
    );

    expect(enhancedOptions).toEqual({
      detour: false,
      org: 'org-without-snyk-legacy-cpp-ff',
    });
  });

  it('hasCppToDetourFlow - ecosystem `cpp` has detour set as true when org has snykLegacyCpp feature flag', async () => {
    const ecosystem = 'cpp';
    const options = { org: 'org-with-snyk-legacy-cpp-ff' } as Options;

    const isFeatureFlagSupportedForOrgSpy = jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({
        ok: true,
      });

    const enhancedOptions = {
      ...options,
      detour: await hasToDetourToLegacyFlow(ecosystem, options),
    };

    expect(isFeatureFlagSupportedForOrgSpy).toBeCalledWith(
      'snykLegacyCpp',
      'org-with-snyk-legacy-cpp-ff',
    );

    expect(enhancedOptions).toEqual({
      detour: true,
      org: 'org-with-snyk-legacy-cpp-ff',
    });
  });
});
