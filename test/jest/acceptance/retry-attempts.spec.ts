import { runSnykCLI } from '../util/runSnykCLI';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { getAvailableServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('max-attempts configuration', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let port: string;
  const baseApi = '/api/v1';
  const ipAddress = getFirstIPv4Address();
  const selfEndpointResponses = [500, 500, 200];

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
    await server.listenPromise(port);
  });

  beforeEach(() => {
    const defaultResponse = {
      jsonapi: {
        version: '1.0',
      },
      data: {
        type: 'user',
        id: '11111111-2222-3333-4444-555555555555',
        attributes: {
          name: 'Messi',
          default_org_context: '55555555-5555-5555-5555-555555555555',
          username: 'test.user@snyk.io',
          email: 'test.user@snyk.io',
          avatar_url: 'https://s.gravatar.com/avatar/snykdog.png',
        },
      },
      links: {
        self: '/self?version=2024-10-15',
      },
    };
    server.setEndpointResponse('/api/rest/self', defaultResponse);
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  it('retries multiple times on repeated 500 errors', async () => {
    server.setEndpointStatusCodes('/api/rest/self', [...selfEndpointResponses]);

    const { code } = await runSnykCLI(
      `whoami --experimental --max-attempts=3`,
      {
        env: env,
      },
    );

    expect(code).toBe(0);
    const selfRequests = server
      .getRequests()
      .filter((r) => r.url.includes('/rest/self'));
    expect(selfRequests.length).toBeGreaterThanOrEqual(3);
  });

  it('fails after exhausting retry attempts', async () => {
    server.setEndpointStatusCodes('/api/rest/self', [...selfEndpointResponses]);

    const { code, stdout } = await runSnykCLI(
      `whoami --experimental --max-attempts=1`,
      {
        env: env,
      },
    );

    console.log(stdout);

    expect(code).not.toBe(0);
  });

  it('accepts SNYK_MAX_ATTEMPTS env var', async () => {
    server.setEndpointStatusCodes('/api/rest/self', [...selfEndpointResponses]);

    const { code } = await runSnykCLI(
      `whoami --experimental --max-attempts=1`,
      {
        env: {
          ...env,
          SNYK_MAX_ATTEMPTS: '3',
        },
      },
    );

    expect(code).toBe(0);
    expect(server.getRequests().length).toBeGreaterThanOrEqual(2);
  });
});
