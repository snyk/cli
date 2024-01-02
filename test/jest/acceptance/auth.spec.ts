import { fakeServer } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('Auth', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = process.env.PORT || process.env.SNYK_PORT || '12345';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + apiPort + apiPath,
      SNYK_DISABLE_ANALYTICS: '1',
    };

    server = fakeServer(apiPath, env.SNYK_TOKEN);
    server.listen(apiPort, () => done());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => done());
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
});
