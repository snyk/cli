import * as os from 'os';

const isWindows = os.platform().indexOf('win') === 0;

export const fipsTestsEnabled = (): boolean => {
  const required = process.env.TEST_SNYK_FIPS == '1';
  return required;
};

export const getFipsEnabledEnvironment = (
  env = { ...process.env },
): Record<string, string | undefined> => {
  if (!isWindows) {
    env.OPENSSL_CONF = '/usr/local/ssl/openssl_fips_enabled.cnf';
    return env;
  }
  return {};
};

export const getFipsDisabledEnvironment = (
  env = { ...process.env },
): Record<string, string | undefined> => {
  if (!isWindows) {
    delete env.OPENSSL_CONF;
  }
  return env;
};
