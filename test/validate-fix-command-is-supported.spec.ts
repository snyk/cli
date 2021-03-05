import { validateFixCommandIsSupported } from '../src/cli/commands/fix/validate-fix-command-is-supported';
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

  it('fix is NOT supported for OS projects + disabled FF', () => {
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: false });
    const options = { path: '/', showVulnPaths: 'all' as ShowVulnPaths };
    expect(validateFixCommandIsSupported(options)).rejects.toThrowError('');
  });

  it('fix is NOT supported for --source + enabled FF', () => {
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: true });
    const options = {
      path: '/',
      showVulnPaths: 'all' as ShowVulnPaths,
      source: true,
    };
    expect(validateFixCommandIsSupported(options)).rejects.toThrowError('');
  });

  it('fix is NOT supported for --docker + enabled FF', () => {
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: true });
    const options = {
      path: '/',
      showVulnPaths: 'all' as ShowVulnPaths,
      docker: true,
    };
    expect(validateFixCommandIsSupported(options)).rejects.toThrowError('');
  });

  it('fix is NOT supported for --code + enabled FF', () => {
    jest
      .spyOn(featureFlags, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({ ok: true });
    const options = {
      path: '/',
      showVulnPaths: 'all' as ShowVulnPaths,
      code: true,
    };
    expect(validateFixCommandIsSupported(options)).rejects.toThrowError('');
  });
});
