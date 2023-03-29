import { runSnykCLI } from '../util/runSnykCLI';
import { fakeServer } from '../../acceptance/fake-server';

jest.setTimeout(1000 * 60 * 5);

describe('cli token precedence', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  const port = process.env.PORT || process.env.SNYK_PORT || '12345';
  const baseApi = '/api/v1';
  const defaultEnv = {
    ...process.env,
    SNYK_API: 'http://localhost:' + port + baseApi,
    SNYK_HOST: 'http://localhost:' + port,
  };

  beforeAll((done) => {
    env = defaultEnv;
    server = fakeServer(baseApi, 'snykToken');
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
    env = defaultEnv;
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
    envVars: Record<string, string>;
  };

  const snykAPIConfig: AuthConfig = {
    name: 'snykAPI',
    expectedAuthType: 'token',
    expectedToken: 'snykApiToken',
    envVars: {
      SNYK_TOKEN: 'snykApiToken',
    },
  };

  const snykOAuthConfig: AuthConfig = {
    name: 'snykOAuth',
    expectedAuthType: 'Bearer',
    expectedToken: 'configAccessToken',
    envVars: {
      INTERNAL_OAUTH_TOKEN_STORAGE: JSON.stringify({
        access_token: 'configAccessToken',
        token_type: 'Bearer',
        refresh_token: 'configRefreshToken',
        expiry: '3023-03-29T17:47:13.714448+02:00',
      }),
      INTERNAL_SNYK_OAUTH_ENABLED: '1',
    },
  };

  [snykAPIConfig, snykOAuthConfig].forEach((auth) => {
    describe(`when ${auth.name} is set in config`, () => {
      beforeEach(() => {
        env = {
          ...env,
          ...auth.envVars,
        };
      });

      it(`should use ${auth.name} auth type set in config`, async () => {
        await runSnykCLI(`-d`, { env });

        const authHeader = server.popRequest().headers?.authorization;
        expect(authHeader).toEqual(
          `${auth.expectedAuthType} ${auth.expectedToken}`,
        );
      });

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
