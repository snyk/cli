import { isWindowsOperatingSystem } from '../../utils';

const FIPS_OPENSSL_CONF = '/usr/local/ssl/openssl_fips_enabled.cnf';

export const fipsTestsEnabled = (): boolean => {
  const required = process.env.TEST_SNYK_FIPS == '1';
  return required;
};

export const getFipsEnabledEnvironment = (
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> => ({
  ...env,
  OPENSSL_CONF: FIPS_OPENSSL_CONF,
});

export const getFipsDisabledEnvironment = (
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> => ({
  ...env,
  OPENSSL_CONF: undefined,
});

export const withFipsEnvIfNeeded = (
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> => {
  if (!fipsTestsEnabled() || isWindowsOperatingSystem()) {
    return env;
  }

  return {
    OPENSSL_CONF: FIPS_OPENSSL_CONF,
    ...env, // Ensure that any value for `OPENSSL_CONF` in `env` takes precedence
  };
};
