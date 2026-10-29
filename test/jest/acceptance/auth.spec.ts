import { generateKeyPairSync } from 'crypto';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI, runSnykCLIWithArray } from '../util/runSnykCLI';
import { getCliConfig, restoreCliConfig } from '../../acceptance/config-helper';
import { ciEnvs } from '../../../src/lib/is-ci';
import { getServerPort } from '../util/getServerPort';
import { createPAT } from '../util/createPAT';
import { createProject } from '../util/createProject';

jest.setTimeout(1000 * 60);
describe('Auth', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let initialConfig: Record<string, string> = {};
  let fakeServerUrl: string;
  let fakeServerHost: string;
  const serverToken = 'fake-server-api-token';

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = getServerPort(process);
    fakeServerHost = 'http://' + getFirstIPv4Address() + ':' + apiPort;
    fakeServerUrl = fakeServerHost + apiPath;
    env = {
      ...process.env,
      SNYK_CFG_ORG: '11111111-2222-3333-4444-555555555555',
      SNYK_API: fakeServerUrl,
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    };

    ciEnvs.forEach((value) => {
      delete env[value];
    });

    server = fakeServer(apiPath, serverToken);
    server.listen(apiPort, () => done());
  });

  afterAll((done) => {
    server.close(() => done());
  });

  beforeEach(async () => {
    initialConfig = await getCliConfig();
    // delete config
    await runSnykCLI(`config clear`, {
      env,
    });
  });

  afterEach(async () => {
    server.restore();
    await restoreCliConfig(initialConfig);
  });

  describe('token authentication', () => {
    it('successfully uses token authentication with interactive login', async () => {
      const { code } = await runSnykCLI(`auth --auth-type=token -d`, {
        env,
      });
      expect(code).toEqual(0);

      const configGet = await runSnykCLI(`config get api`, {
        env,
      });

      expect(configGet.code).toEqual(0);
      expect(configGet.stdout).toContain(serverToken);
    });

    it('fails to use token authentication with interactive login', async () => {
      server.setEndpointResponse('/api/v1/verify/callback', {
        error: 'Internal server error',
      });
      server.setEndpointStatusCode('/api/v1/verify/callback', 500);

      const { code } = await runSnykCLI(`auth --auth-type=token`, {
        env,
      });
      expect(code).toEqual(2);
    });
  });

  describe('oauth authentication', () => {
    it('successfully uses oauth with interactive login', async () => {
      const { code } = await runSnykCLI(`auth --auth-type=oauth`, {
        env,
      });
      expect(code).toEqual(0);

      const configGet = await runSnykCLI(
        `config get INTERNAL_OAUTH_TOKEN_STORAGE`,
        {
          env,
        },
      );

      expect(configGet.code).toEqual(0);
      const token = JSON.parse(configGet.stdout);
      expect(token.access_token).toEqual('access_token_value');
      expect(token.token_type).toEqual('b');
    });

    it('successfully uses oauth client credentials grant to authenticate', async () => {
      const { code } = await runSnykCLI(
        `auth --auth-type=oauth --client-id a --client-secret b`,
        {
          env,
        },
      );
      expect(code).toEqual(0);

      // Run this command to verify that it succeeds with oauth, since it is implemented in TS
      const ignoreCode = await runSnykCLI(`ignore --id=das`, {
        env,
      });
      expect(ignoreCode.code).toEqual(0);
    });

    it('fails to use oauth with authorization code grant', async () => {
      server.setEndpointResponse('/api/oauth2/token', {
        error: 'Invalid client credentials',
      });
      server.setEndpointStatusCode('/api/oauth2/token', 401);

      const { code } = await runSnykCLI(
        `auth --auth-type=oauth --client-id a --client-secret b`,
        {
          env,
        },
      );
      expect(code).toEqual(2);
    });

    describe('client credentials grant with a private key as client secret', () => {
      const clientId = 'machine-client-id';
      let authArgs: string[];

      beforeAll(() => {
        const { privateKey } = generateKeyPairSync('rsa', {
          modulusLength: 2048,
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
          publicKeyEncoding: { type: 'spki', format: 'pem' },
        });
        authArgs = [
          'auth',
          `--client-id=${clientId}`,
          `--client-secret=${privateKey}`,
        ];
      });

      const storedConfig = async (key: string, storedOutput: unknown) => {
        const configGet = await runSnykCLI(`config get ${key}`, { env });
        expect(configGet.code).toEqual(0);
        expect(configGet.stdout.trim()).toEqual(storedOutput);
        return configGet.stdout.trim()
          ? JSON.parse(configGet.stdout)
          : undefined;
      };

      it.each([
        {
          name: 'stores the key and authenticates later commands with the minted token',
          rejectKey: false,
          authCode: 0,
          storedOutput: expect.stringMatching(/^{/),
          storedClientId: clientId,
          storedAccessToken: 'access_token_value',
          ignoreCode: 0,
          authorization: 'Bearer access_token_value',
        },
        {
          name: 'stores nothing when the token endpoint rejects the key',
          rejectKey: true,
          authCode: 2,
          storedOutput: '',
          storedClientId: undefined,
          storedAccessToken: undefined,
          // With nothing stored the host hands the legacy CLI its placeholder API token.
          ignoreCode: 2,
          authorization: 'token random',
        },
      ])(
        '$name',
        async ({
          rejectKey,
          authCode,
          storedOutput,
          storedClientId,
          storedAccessToken,
          ignoreCode,
          authorization,
        }) => {
          if (rejectKey) {
            server.setEndpointResponse('/api/oauth2/token', {
              error: 'invalid_client',
            });
            server.setEndpointStatusCode('/api/oauth2/token', 401);
          }

          const { code } = await runSnykCLIWithArray(authArgs, { env });
          expect(code).toEqual(authCode);
          const tokenRequest = server
            .getRequests()
            .find((req) => req.url.endsWith('/oauth2/token'));
          expect(tokenRequest?.body.client_assertion_type).toEqual(
            'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          );

          const storedCredential = await storedConfig(
            'INTERNAL_MACHINE_IDENTITY_STORAGE',
            storedOutput,
          );
          expect(storedCredential?.client_id).toEqual(storedClientId);
          const storedToken = await storedConfig(
            'INTERNAL_OAUTH_TOKEN_STORAGE',
            storedOutput,
          );
          expect(storedToken?.access_token).toEqual(storedAccessToken);

          const project = await createProject('empty');
          const requestsBefore = server.getRequests().length;
          const ignore = await runSnykCLI('ignore --id=das', {
            env,
            cwd: project.path(),
          });
          await project.remove();
          expect(ignore.code).toEqual(ignoreCode);
          const authorizationRequest = server
            .getRequests()
            .slice(requestsBefore)
            .find((req) => req.url.includes('/authorization/'));
          expect(authorizationRequest?.headers.authorization).toEqual(
            authorization,
          );
        },
      );
    });

    it('fails to us oauth client credentials grant to authenticate', async () => {
      const { code } = await runSnykCLI(
        `auth --auth-type=oauth --client-id wrong --client-secret b`,
        {
          env,
        },
      );
      expect(code).toEqual(2);
    });
  });

  // Tests for existing token is invalid (for when config value is set incorrectly)  config set api=invalid
  it('ignore existing token when running auth', async () => {
    const resultConfigSet = await runSnykCLI('config set api=invalid', {
      env,
    });
    expect(resultConfigSet.code).toEqual(0);

    // run command under test
    const { code } = await runSnykCLI(`auth --auth-type=token -d`, {
      env,
    });

    const resultConfigGet = await runSnykCLI('config get api', {
      env,
    });

    expect(code).toEqual(0);
    expect(resultConfigGet.code).toEqual(0);
    expect(resultConfigGet.stdout).toContain(serverToken);
  });

  it('fall back to API token based authentication for IDEs per default', async () => {
    const { code } = await runSnykCLI(`auth`, {
      env: { ...env, SNYK_INTEGRATION_NAME: 'VS_CODE' },
    });

    const resultConfigGet = await runSnykCLI('config get api', {
      env,
    });

    expect(code).toEqual(0);
    expect(resultConfigGet.code).toEqual(0);
    expect(resultConfigGet.stdout).toContain(serverToken);
  });

  describe('pat', () => {
    it('prefers pat derived api over SNYK_API', async () => {
      const pat = createPAT({ host: fakeServerHost });
      const authCmd = await runSnykCLI(`auth ${pat} -d`, {
        env: {
          ...env,
          // SNYK_API will actually be used up until the auth workflow
          SNYK_API: 'https://api.this.should.not.be.used.invalid',
        },
      });

      expect(authCmd.code).toEqual(0);

      const configCmd = await runSnykCLI('config get api', {
        env: {
          ...env,
        },
      });
      expect(configCmd.code).toEqual(0);
      expect(configCmd.stdout).toContain(pat);
    });

    it('successfully authenticates', async () => {
      const pat = createPAT({ host: fakeServerHost });
      // create backup of env
      const envBackup = { ...env };
      delete envBackup.SNYK_API;
      const authCmd = await runSnykCLI(`auth ${pat} -d`, {
        env: {
          ...envBackup,
        },
      });

      expect(authCmd.code).toEqual(0);

      const configCmd = await runSnykCLI('config get api', {
        env: {
          ...envBackup,
        },
      });
      expect(configCmd.code).toEqual(0);
      expect(configCmd.stdout).toContain(pat);
    });
  });
});
