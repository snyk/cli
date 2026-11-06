import { restoreSystemEnvironment } from '../../../../src/lib/system-environment';

describe('restoreSystemEnvironment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns a new object and does not mutate the input', () => {
    process.env.SNYK_SYSTEM_HTTP_PROXY = 'http://user-proxy:8080';
    const input = { SNYK_TOKEN: 'random', HTTP_PROXY: 'http://go-proxy' };

    const result = restoreSystemEnvironment(input);

    expect(result).not.toBe(input);
    expect(input).toEqual({
      SNYK_TOKEN: 'random',
      HTTP_PROXY: 'http://go-proxy',
    });
    expect(result.HTTP_PROXY).toBe('http://user-proxy:8080');
  });

  it('removes SNYK_TOKEN when it is "random"', () => {
    const result = restoreSystemEnvironment({ SNYK_TOKEN: 'random' });

    expect(result).not.toHaveProperty('SNYK_TOKEN');
  });

  it('keeps SNYK_TOKEN when it is a real token', () => {
    const result = restoreSystemEnvironment({ SNYK_TOKEN: 'real-token' });

    expect(result.SNYK_TOKEN).toBe('real-token');
  });

  it('keeps other SNYK_* variables', () => {
    const result = restoreSystemEnvironment({
      SNYK_API: 'https://api.snyk.io',
      SNYK_CFG_ORG: 'my-org',
    });

    expect(result.SNYK_API).toBe('https://api.snyk.io');
    expect(result.SNYK_CFG_ORG).toBe('my-org');
  });

  it('restores proxy and OpenSSL settings from SNYK_SYSTEM_* in process.env', () => {
    process.env.SNYK_SYSTEM_HTTP_PROXY = 'http://user-proxy:8080';
    process.env.SNYK_SYSTEM_HTTPS_PROXY = 'https://user-proxy:8443';
    process.env.SNYK_SYSTEM_NO_PROXY = 'localhost';
    process.env.SNYK_SYSTEM_OPENSSL_CONF = '/user/openssl.cnf';

    const result = restoreSystemEnvironment({
      HTTP_PROXY: 'http://go-proxy',
      HTTPS_PROXY: 'https://go-proxy',
      NO_PROXY: 'go-only',
      OPENSSL_CONF: '/go/openssl.cnf',
    });

    expect(result).toMatchObject({
      HTTP_PROXY: 'http://user-proxy:8080',
      HTTPS_PROXY: 'https://user-proxy:8443',
      NO_PROXY: 'localhost',
      OPENSSL_CONF: '/user/openssl.cnf',
    });
  });

  it('removes a proxy variable when its SNYK_SYSTEM_* value is empty', () => {
    process.env.SNYK_SYSTEM_HTTP_PROXY = '';

    const result = restoreSystemEnvironment({ HTTP_PROXY: 'http://go-proxy' });

    expect(result).not.toHaveProperty('HTTP_PROXY');
  });

  it('leaves a proxy variable alone when its SNYK_SYSTEM_* value is unset', () => {
    delete process.env.SNYK_SYSTEM_HTTP_PROXY;

    const result = restoreSystemEnvironment({ HTTP_PROXY: 'http://go-proxy' });

    expect(result.HTTP_PROXY).toBe('http://go-proxy');
  });
});
