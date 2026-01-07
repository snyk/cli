import { validateFixCommandIsSupported } from '../../../src/cli/commands/fix/validate-fix-command-is-supported';
import { AuthFailedError } from '../../../src/lib/errors';
import { FeatureNotSupportedByEcosystemError } from '../../../src/lib/errors/not-supported-by-ecosystem';
import * as featureFlagGateway from '../../../src/lib/feature-flag-gateway';
import { ShowVulnPaths } from '../../../src/lib/types';

jest.mock('../../../src/lib/feature-flag-gateway');

describe('setDefaultTestOptions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('fix is supported for OS projects + enabled FF', () => {
    (
      featureFlagGateway.getEnabledFeatureFlags as jest.Mock
    ).mockResolvedValueOnce(new Set(['cliSnykFix']));
    const options = { path: '/', showVulnPaths: 'all' as ShowVulnPaths };
    const supported = validateFixCommandIsSupported(options);
    expect(supported).toBeTruthy();
  });

  it('fix is NOT supported for OS projects + disabled FF', async () => {
    (
      featureFlagGateway.getEnabledFeatureFlags as jest.Mock
    ).mockResolvedValueOnce(new Set());
    const options = { path: '/', showVulnPaths: 'all' as ShowVulnPaths };
    await expect(validateFixCommandIsSupported(options)).rejects.toThrowError(
      'snykFixSupported is false',
    );
  });

  it('fix is NOT supported and bubbles up auth error invalid auth token', async () => {
    (
      featureFlagGateway.getEnabledFeatureFlags as jest.Mock
    ).mockResolvedValueOnce(new Set());
    const options = { path: '/', showVulnPaths: 'all' as ShowVulnPaths };
    await expect(validateFixCommandIsSupported(options)).rejects.toThrowError(
      AuthFailedError('snykFixSupported is false', 403),
    );
  });

  it('fix is NOT supported for --unmanaged + enabled FF', async () => {
    (
      featureFlagGateway.getEnabledFeatureFlags as jest.Mock
    ).mockResolvedValueOnce(new Set(['cliSnykFix']));
    const options = {
      path: '/',
      showVulnPaths: 'all' as ShowVulnPaths,
      unmanaged: true,
    };
    await expect(validateFixCommandIsSupported(options)).rejects.toThrowError(
      new FeatureNotSupportedByEcosystemError('snyk fix', 'cpp'),
    );
  });

  it('fix is NOT supported for --docker + enabled FF', async () => {
    (
      featureFlagGateway.getEnabledFeatureFlags as jest.Mock
    ).mockResolvedValueOnce(new Set(['cliSnykFix']));
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
    (
      featureFlagGateway.getEnabledFeatureFlags as jest.Mock
    ).mockResolvedValueOnce(new Set(['cliSnykFix']));
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
