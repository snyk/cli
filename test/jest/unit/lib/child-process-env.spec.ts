import {
  captureAndScrubCredentialEnv,
  getCredentialEnv,
  resetCapturedCredentialEnv,
  withCredentialEnv,
} from '../../../../src/lib/child-process-env';

describe('child-process-env', () => {
  afterEach(() => {
    resetCapturedCredentialEnv();
  });

  it('removes Snyk credentials from the env and keeps everything else', () => {
    const env: NodeJS.ProcessEnv = {
      SNYK_TOKEN: 'secret',
      SNYK_OAUTH_TOKEN: 'oauth',
      SNYK_DOCKER_TOKEN: 'docker',
      SNYK_CFG_API: 'cfg',
      SNYK_API: 'https://api.snyk.io',
      PATH: '/usr/bin',
    };
    captureAndScrubCredentialEnv(env);
    expect(env).toEqual({ SNYK_API: 'https://api.snyk.io', PATH: '/usr/bin' });
  });

  it('keeps scrubbed credentials readable', () => {
    captureAndScrubCredentialEnv({ SNYK_OAUTH_TOKEN: 'oauth' });
    expect(getCredentialEnv('SNYK_OAUTH_TOKEN')).toBe('oauth');
  });

  it('matches names case-insensitively (Windows)', () => {
    const env: NodeJS.ProcessEnv = { Snyk_Token: 'secret', Path: 'x' };
    captureAndScrubCredentialEnv(env);
    expect(env).toEqual({ Path: 'x' });
    expect(getCredentialEnv('SNYK_TOKEN')).toBe('secret');
  });

  it('removes empty credential variables without capturing them', () => {
    const env: NodeJS.ProcessEnv = { SNYK_TOKEN: '' };
    captureAndScrubCredentialEnv(env);
    expect(env).toEqual({});
    expect(getCredentialEnv('SNYK_TOKEN')).toBeUndefined();
    expect(withCredentialEnv({})).toEqual({});
  });

  it('removes snyk-iac-test credential overrides', () => {
    const env: NodeJS.ProcessEnv = {
      SNYK_IAC_TEST_API_REST_TOKEN: 'rest',
      SNYK_IAC_TEST_API_REST_OAUTH_TOKEN: 'rest-oauth',
      SNYK_IAC_TEST_API_V1_TOKEN: 'v1',
      SNYK_IAC_TEST_API_V1_OAUTH_TOKEN: 'v1-oauth',
      SNYK_IAC_TEST_API_REST_URL: 'https://api.snyk.io/rest',
    };
    captureAndScrubCredentialEnv(env);
    expect(env).toEqual({
      SNYK_IAC_TEST_API_REST_URL: 'https://api.snyk.io/rest',
    });
    expect(getCredentialEnv('SNYK_IAC_TEST_API_V1_OAUTH_TOKEN')).toBe(
      'v1-oauth',
    );
  });

  it('falls back to process.env before the scrub', () => {
    process.env.SNYK_DOCKER_TOKEN = 'docker';
    try {
      expect(getCredentialEnv('SNYK_DOCKER_TOKEN')).toBe('docker');
    } finally {
      delete process.env.SNYK_DOCKER_TOKEN;
    }
  });

  it('puts credentials back into a copy of the env', () => {
    captureAndScrubCredentialEnv({ SNYK_TOKEN: 'secret' });
    const input = { PATH: '/usr/bin' };
    expect(withCredentialEnv(input)).toEqual({
      PATH: '/usr/bin',
      SNYK_TOKEN: 'secret',
    });
    expect(input).toEqual({ PATH: '/usr/bin' });
  });
});
