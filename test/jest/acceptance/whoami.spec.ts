import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getServerPort } from '../util/getServerPort';
import { getCliConfig, restoreCliConfig } from '../../acceptance/config-helper';
import { createPAT } from '../util/createPAT';

jest.setTimeout(1000 * 60);

describe('whoami', () => {
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
      // override the auth host regex check, else host will be rejected
      INTERNAL_OAUTH_ALLOWED_HOSTS: '.*',
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

  it('handles 503 status code', async () => {
    server.setCustomResponse({
      status: 503,
      body: 'Snyk is currently down for maintenance.',
      headers: {
        'x-snyk-maintenance': 'true',
        'Content-Type': 'text/plain',
      },
    });
    const whoamicmd = await runSnykCLI(`whoami --experimental -d`, {
      env,
      logErrors: true,
    });

    expect(whoamicmd.code).toBe(2);
    expect(whoamicmd.stdout).toContain('SNYK-0009');
    expect(whoamicmd.stdout).toContain('Unable to fulfill the request');
  });
});
