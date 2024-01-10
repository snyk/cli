import { fakeServer } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('Auth', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let initialConfig: Record<string, string> = {};

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = process.env.PORT || process.env.SNYK_PORT || '12345';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + apiPort + apiPath,
      SNYK_DISABLE_ANALYTICS: '1',
    };

    server = fakeServer(apiPath, 'random');
    server.listen(apiPort, () => done());
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
    console.debug('after server restore\n');

    // reset config to initial state
    await runSnykCLI('config clear', { env });
    if (Object.keys(initialConfig).length > 0) {
      for (const key in initialConfig) {
        await runSnykCLI(`config set ${key}=${initialConfig[key]}`, { env });
      }
    }
  });

  afterAll((done) => {
    server.close(() => done());
    console.debug('after server close\n');
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
  it.only('successfully unsets token when config value is set incorrectly', async () => {
    const resultConfigSet = await runSnykCLI('config set api=invalid', {
      env,
    });
    expect(resultConfigSet.code).toEqual(0);
    console.debug('before Snyk Auth\n');

    const { code } = await runSnykCLI(`auth`, {
      env,
    });
    console.debug('after Snyk Auth and before config get\n');
    const resultConfigGet = await runSnykCLI('config get api', {
      env,
    });
    console.debug('after config get\n');
    expect(code).toEqual(0);
    expect(resultConfigGet.code).toEqual(0);
    expect(resultConfigGet.stdout).toContain('invalid');
  });
});
