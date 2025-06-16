import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getCliConfig, restoreCliConfig } from '../../acceptance/config-helper';
import { ciEnvs } from '../../../src/lib/is-ci';
import { getServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 60);
describe('Auth', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let initialConfig: Record<string, string> = {};
  let fakeServerUrl: string;
  const serverToken = 'random';

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = getServerPort(process);
    fakeServerUrl = 'http://' + getFirstIPv4Address() + ':' + apiPort + apiPath;
    env = {
      ...process.env,
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

  it('fails to us oauth client credentials grant to authenticate', async () => {
    const { code } = await runSnykCLI(
      `auth --auth-type=oauth --client-id wrong --client-secret b`,
      {
        env,
      },
    );
    expect(code).toEqual(2);
  });

  // Tests for existing token is invalid (for when config value is set incorrectly)  config set api=invalid
  it('ignore existing token when running auth', async () => {
    const resultConfigSet = await runSnykCLI('config set api=invalid', {
      env,
    });
    expect(resultConfigSet.code).toEqual(0);

    // run command under test
    const { code, stderr } = await runSnykCLI(`auth --auth-type=token -d`, {
      env,
    });

    console.debug(stderr);

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
    it('successfully authenticates', async () => {
      const pat = 'snyk_uat.12345678.abcdefg-hijklmnop.qrstuvwxyz-123456';
      const authCmd = await runSnykCLI(`auth ${pat} -d`, {
        env: {
          ...env,
          SNYK_API: `${fakeServerUrl.replace('/api/v1', '')}`,
        },
      });
      expect(authCmd.code).toEqual(0);

      const configCmd = await runSnykCLI('config get api', {
        env: {
          ...env,
          SNYK_API: `${fakeServerUrl.replace('/v1', '')}`,
        },
      });
      expect(configCmd.code).toEqual(0);
      expect(configCmd.stdout).toContain(pat);
    });
  });
});
