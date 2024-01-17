import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getCliConfig, restoreCliConfig } from '../../acceptance/config-helper';
import { ciEnvs } from '../../../src/lib/is-ci';

jest.setTimeout(1000 * 60);

describe('Auth', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let initialConfig: Record<string, string> = {};
  const serverToken = 'random';

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = process.env.PORT || process.env.SNYK_PORT || '12345';
    env = {
      ...process.env,
      SNYK_API: 'http://' + getFirstIPv4Address() + ':' + apiPort + apiPath,
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

    // delete test token
    await runSnykCLI(`config unset INTERNAL_OAUTH_TOKEN_STORAGE`, {
      env,
    });
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
});
