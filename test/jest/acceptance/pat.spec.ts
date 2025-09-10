import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getServerPort } from '../util/getServerPort';
import { getCliConfig, restoreCliConfig } from '../../acceptance/config-helper';
import { createPAT } from '../util/createPAT';

jest.setTimeout(1000 * 60);

describe('PAT', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let pat: string;
  let initialConfig: Record<string, string> = {};

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = getServerPort(process);
    const host = `http://${getFirstIPv4Address()}:${apiPort}`;
    pat = createPAT({ host });
    env = {
      ...process.env,
      SNYK_TOKEN: pat,
      SNYK_DISABLE_ANALYTICS: '1',
    };

    server = fakeServer(apiPath, env.SNYK_TOKEN);
    server.listen(apiPort, () => done());
  });

  afterAll((done) => {
    server.close(() => done());
  });

  beforeEach(async () => {
    // backup snyk config
    initialConfig = await getCliConfig();
    await runSnykCLI(`config clear`, {
      env,
    });
  });

  afterEach(async () => {
    await restoreCliConfig(initialConfig);
    server.restore();
  });

  it('derives api from pat for authorised requests', async () => {
    const whoamicmd = await runSnykCLI(`whoami --experimental -d`, {
      env,
      logErrors: true,
    });
    expect(whoamicmd.code).toEqual(0);

    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    server.getRequests().forEach((request) => {
      expect(request).toMatchObject({
        headers: {
          authorization: `token ${pat}`,
        },
      });
    });
  });

  it('api derived from pat takes precedence over SNYK_API', async () => {
    const whoamicmd = await runSnykCLI(`whoami --experimental -d`, {
      env: {
        ...env,
        SNYK_API: 'https://api.this.should.not.be.used.io',
      },
      logErrors: true,
    });
    expect(whoamicmd.code).toEqual(0);

    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    server.getRequests().forEach((request) => {
      expect(request).toMatchObject({
        headers: {
          authorization: `token ${pat}`,
        },
      });
    });
  });

  it('auth error when pat is invalid', async () => {
    const invalidPat = 'snyk_uat.12345678.thisisa-ninvalidp.atnotvalid-123456';
    const whoamicmd = await runSnykCLI(`whoami --experimental -d`, {
      env: {
        ...env,
        // make a real API request with an invalid token
        SNYK_TOKEN: invalidPat,
      },
    });

    expect(whoamicmd.code).toEqual(2);
    expect(whoamicmd.stdout).toContain('Authentication error');
  });
});
