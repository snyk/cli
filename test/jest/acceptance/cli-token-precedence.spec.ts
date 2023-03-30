import { runSnykCLI } from '../util/runSnykCLI';
import { fakeServer } from '../../acceptance/fake-server';
import { isCLIV2 } from '../util/isCLIV2';

jest.setTimeout(1000 * 30); // 30 seconds

describe('cli token precedence', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let initialConfig: Record<string, string> = {};

  const port = process.env.PORT || process.env.SNYK_PORT || '12345';
  const baseApi = '/api/v1';
  const initialEnvVars = {
    ...process.env,
    SNYK_API: 'http://localhost:' + port + baseApi,
    SNYK_HOST: 'http://localhost:' + port,
  };

  beforeAll((done) => {
    env = initialEnvVars;
    server = fakeServer(baseApi, 'snykToken');
    server.listen(port, () => {
      done();
    });
  });

  beforeAll(async () => {
    // save initial config
    const { stdout } = await runSnykCLI('config', { env });
    if (stdout) {
      initialConfig = stdout
        .trim()
        .split('\n')
        .reduce((acc, line) => {
          const [key, value] = line.split(': ');
          return {
            ...acc,
            [key]: value,
          };
        }, {});
    }
  });

  afterEach(async () => {
    server.restore();
    env = initialEnvVars;

    // reset config to initial state
    await runSnykCLI('config clear', { env });
    if (Object.keys(initialConfig).length > 0) {
      for (const key in initialConfig) {
        await runSnykCLI(`config set ${key}=${initialConfig[key]}`, { env });
      }
    }
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  type AuthConfig = {
    name: string;
    expectedAuthType: string;
    expectedToken: string;
    snykConfig?: Record<string, string>;
  };

  const snykAPIConfig: AuthConfig = {
    name: 'snykAPI',
    expectedAuthType: 'token',
    expectedToken: 'snykApiToken',
    snykConfig: {
      api: 'snykApiToken',
    },
  };

  const internalOAuthTokenStorage = {
    access_token: 'configAccessToken',
    token_type: 'Bearer',
    refresh_token: 'configRefreshToken',
    expiry: '3023-03-29T17:47:13.714448+02:00',
  };
  const snykOAuthConfig: AuthConfig = {
    name: 'snykOAuth',
    expectedAuthType: 'Bearer',
    expectedToken: 'configAccessToken',
    snykConfig: {
      internal_oauth_token_storage: JSON.stringify(internalOAuthTokenStorage),
      internal_snyk_oauth_enabled: '1',
    },
  };

  [snykAPIConfig, snykOAuthConfig].forEach((auth) => {
    describe(`when ${auth.name} is set in config`, () => {
      beforeEach(async () => {
        // inject config
        for (const key in auth.snykConfig) {
          await runSnykCLI(`config set ${key}=${auth.snykConfig[key]}`);
        }
      });

      if (isCLIV2()) {
        it(`should use ${auth.name} auth type set in config`, async () => {
          await runSnykCLI(`-d`, { env });
          const authHeader = server.popRequest().headers?.authorization;
          expect(authHeader).toEqual(
            `${auth.expectedAuthType} ${auth.expectedToken}`,
          );
        });
      }

      describe('when oauth env vars are set', () => {
        it('SNYK_OAUTH_TOKEN should override config', async () => {
          env = {
            ...env,
            SNYK_OAUTH_TOKEN: 'snkyOAuthToken',
          };

          await runSnykCLI(`-d`, { env });

          const authHeader = server.popRequest().headers?.authorization;
          expect(authHeader).toEqual(`Bearer ${env.SNYK_OAUTH_TOKEN}`);
        });

        it('SNYK_DOCKER_TOKEN should override config', async () => {
          env = {
            ...env,
            SNYK_DOCKER_TOKEN: 'snykDockerToken',
          };

          await runSnykCLI(`-d`, { env });

          const authHeader = server.popRequest().headers?.authorization;
          expect(authHeader).toEqual(`Bearer ${env.SNYK_DOCKER_TOKEN}`);
        });
      });

      describe('when token env vars are set', () => {
        it('SNYK_TOKEN should override config', async () => {
          env = {
            ...env,
            SNYK_TOKEN: 'snykToken',
          };

          await runSnykCLI(`-d`, { env });

          const authHeader = server.popRequest().headers?.authorization;
          expect(authHeader).toEqual(`token ${env.SNYK_TOKEN}`);
        });

        it('SNYK_CFG_API should override config', async () => {
          env = {
            ...env,
            SNYK_CFG_API: 'snykCfgApiToken',
          };

          await runSnykCLI(`-d`, { env });

          const authHeader = server.popRequest().headers?.authorization;
          expect(authHeader).toEqual(`token ${env.SNYK_CFG_API}`);
        });
      });
    });
  });
});
