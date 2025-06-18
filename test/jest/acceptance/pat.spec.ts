import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('PAT', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let serverUrl: string;

  const pat = 'snyk_uat.12345678.abcdefg-hijklmnop.qrstuvwxyz-123456';

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = getServerPort(process);
    const host = `http://${getFirstIPv4Address()}:${apiPort}${apiPath}`;
    serverUrl = host.replace('/v1', '');
    env = {
      ...process.env,
      SNYK_API: host + apiPort + apiPath,
      SNYK_TOKEN: pat,
      SNYK_DISABLE_ANALYTICS: '1',
      INTERNAL_SNYK_REGION_URLS: serverUrl,
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

  it('uses pat for authorised requests', async () => {
    const helpCmd = await runSnykCLI(`whoami --experimental -d`, { env });
    expect(helpCmd.code).toEqual(0);

    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    server.getRequests().forEach((request) => {
      expect(request).toMatchObject({
        headers: {
          authorization: `token ${pat}`,
        },
      });
    });
  });

  it('uses pat derived endpoint for authorised requests', async () => {
    const euBasedPat = 'snyk_uat.12345678.thisisa-europecon.figuredpat-123456';
    const helpCmd = await runSnykCLI(`help -d`, {
      env: {
        ...env,
        SNYK_TOKEN: euBasedPat,
        SNYK_API: `${serverUrl.replace('/api', '')}`,
      },
    });

    expect(helpCmd.code).toEqual(0);
    const expectedEndpoint = 'https://api.eu.snyk.io';
    const expectedRegion = 'snyk-eu-01';
    expect(helpCmd.stderr).toContain(expectedEndpoint);
    expect(helpCmd.stderr).toContain(expectedRegion);

    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    server.getRequests().forEach((request) => {
      expect(request).toMatchObject({
        headers: {
          authorization: `token ${euBasedPat}`,
        },
      });
    });
  });

  it('auth error when pat is invalid', async () => {
    const invalidPat = 'snyk_uat.12345678.thisisa-ninvalidp.atnotvalid-123456';
    const whoamiCmd = await runSnykCLI(`whoami --experimental -d`, {
      env: {
        ...env,
        // make a real API request with an invalid token
        SNYK_TOKEN: invalidPat,
        SNYK_API: 'https://api.snyk.io',
      },
    });

    expect(whoamiCmd.code).toEqual(2);
    expect(whoamiCmd.stdout).toContain('Authentication error');
  });

  it('fallbacks to different apis to validate the pat', async () => {
    // note that the fallback logic also shuffles the order of apis to try
    // as long as one api works this test should pass
    const commaDelimitedApis = `${serverUrl},http://someRandomApi.io,http://anotherRandomApi.io`;

    const helpCmd = await runSnykCLI(`help -d`, {
      env: {
        ...env,
        INTERNAL_SNYK_REGION_URLS: commaDelimitedApis,
      },
    });

    expect(helpCmd.code).toEqual(0);

    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    server.getRequests().forEach((request) => {
      expect(request).toMatchObject({
        headers: {
          authorization: `token ${pat}`,
        },
      });
    });
  });

  it('fails if all fallbacks fail', async () => {
    const commaDelimitedApis = `http://notValidApi.io,http://someRandomApi.io,http://anotherRandomApi.io`;

    const whoami = await runSnykCLI(`whoami --experimental -d`, {
      env: {
        ...env,
        INTERNAL_SNYK_REGION_URLS: commaDelimitedApis,
      },
    });

    expect(whoami.code).toEqual(2);
    expect(whoami.stdout).toContain('Authentication error');
  });
});
