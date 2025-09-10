import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getCliConfig, restoreCliConfig } from '../../acceptance/config-helper';
import { ciEnvs } from '../../../src/lib/is-ci';
import { getServerPort } from '../util/getServerPort';
import { createPAT } from '../util/createPAT';

jest.setTimeout(1000 * 60);
describe('Auth', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let initialConfig: Record<string, string> = {};
  let fakeServerUrl: string;
  let fakeServerHost: string;
  const serverToken = 'random';

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
          SNYK_API: 'https://api.this.should.not.be.used.io',
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
