import { runSnykCLI } from '../util/runSnykCLI';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { getAvailableServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('retry-attempts configuration', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let port: string;
  const baseApi = '/api/v1';
  const ipAddress = getFirstIPv4Address();

  beforeAll(async () => {
    port = await getAvailableServerPort(process);
    env = {
      ...process.env,
      SNYK_API: `http://${ipAddress}:${port}${baseApi}`,
      SNYK_HOST: `http://${ipAddress}:${port}`,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await new Promise<void>((resolve) => server.listen(Number(port), resolve));
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  it('retries on 500 error and succeeds when server recovers', async () => {
    // First request returns 500, second returns 200
    server.setStatusCodes([500, 200]);

    const { code } = await runSnykCLI(
      `whoami --experimental --retry-attempts=3`,
      {
        env,
      },
    );

    expect(code).toBe(0);
    expect(server.getRequests().length).toBeGreaterThanOrEqual(2);
  });

  it('retries multiple times on repeated 500 errors', async () => {
    // First two requests return 500, third returns 200
    server.setStatusCodes([500, 500, 200]);

    const { code } = await runSnykCLI(
      `whoami --experimental --retry-attempts=3`,
      {
        env,
      },
    );

    expect(code).toBe(0);
    expect(server.getRequests().length).toBeGreaterThanOrEqual(3);
  });

  it('fails after exhausting retry attempts', async () => {
    // All requests return 500
    server.setStatusCode(500);

    const { code } = await runSnykCLI(
      `whoami --experimental --retry-attempts=2`,
      {
        env,
      },
    );

    expect(code).not.toBe(0);
  });

  it('accepts SNYK_RETRY_ATTEMPTS env var', async () => {
    server.setStatusCodes([500, 200]);

    const { code } = await runSnykCLI(`whoami --experimental`, {
      env: {
        ...env,
        SNYK_RETRY_ATTEMPTS: '3',
      },
    });

    expect(code).toBe(0);
    expect(server.getRequests().length).toBeGreaterThanOrEqual(2);
  });
});
