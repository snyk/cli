import { validateFixCommandIsSupported } from '../src/cli/commands/fix/validate-fix-command-is-supported';
import { AuthFailedError } from '../src/lib/errors';
import { FeatureNotSupportedByEcosystemError } from '../src/lib/errors/not-supported-by-ecosystem';
import * as featureFlags from '../src/lib/feature-flags';
import { ShowVulnPaths } from '../src/lib/types';
describe('setDefaultTestOptions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('fix is supported for OS projects + enabled FF', () => {
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: true });
    const options = { path: '/', showVulnPaths: 'all' as ShowVulnPaths };
    const supported = validateFixCommandIsSupported(options);
    expect(supported).toBeTruthy();
  });

  it('fix is NOT supported for OS projects + disabled FF', async () => {
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: false });
    const options = { path: '/', showVulnPaths: 'all' as ShowVulnPaths };
    await expect(validateFixCommandIsSupported(options)).rejects.toThrowError(
      '`snyk fix` is not supported',
    );
  });

  it('fix is NOT supported and bubbles up auth error invalid auth token', async () => {
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: false, code: 401, error: 'Invalid auth token' });
    const options = { path: '/', showVulnPaths: 'all' as ShowVulnPaths };
    await expect(validateFixCommandIsSupported(options)).rejects.toThrowError(
      AuthFailedError('Invalid auth token', 401),
    );
  });

  it('fix is NOT supported for --source + enabled FF', async () => {
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: true });
    const options = {
      path: '/',
      showVulnPaths: 'all' as ShowVulnPaths,
      source: true,
    };
    await expect(validateFixCommandIsSupported(options)).rejects.toThrowError(
      new FeatureNotSupportedByEcosystemError('snyk fix', 'cpp'),
    );
  });

  it('fix is NOT supported for --docker + enabled FF', async () => {
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: true });
    const options = {
      path: '/',
      showVulnPaths: 'all' as ShowVulnPaths,
      docker: true,
    };
    await expect(validateFixCommandIsSupported(options)).rejects.toThrowError(
      new FeatureNotSupportedByEcosystemError('snyk fix', 'docker'),
    );
  });

  it('fix is NOT supported for --code + enabled FF', async () => {
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: true });
    const options = {
      path: '/',
      showVulnPaths: 'all' as ShowVulnPaths,
      code: true,
    };
    await expect(validateFixCommandIsSupported(options)).rejects.toThrowError(
      new FeatureNotSupportedByEcosystemError('snyk fix', 'code'),
    );
  });
});
