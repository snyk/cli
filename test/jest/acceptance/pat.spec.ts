import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('PAT', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let pat: string;

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = getServerPort(process);
    const apiBaseUrl = `${getFirstIPv4Address()}:${apiPort}`;
    const payload = `{"h":"http://${apiBaseUrl}"}`;
    pat = createPAT(payload);
    env = {
      ...process.env,
      SNYK_TOKEN: pat,
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

  it('derives api from pat for authorised requests', async () => {
    const whoamicmd = await runSnykCLI(`whoami --experimental -d`, { env });
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
    const whoamiCmd = await runSnykCLI(`whoami --experimental -d`, {
      env: {
        ...env,
        // make a real API request with an invalid token
        SNYK_TOKEN: invalidPat,
      },
    });

    expect(whoamiCmd.code).toEqual(2);
    expect(whoamiCmd.stdout).toContain('Authentication error');
  });
});

function createPAT(payload: string): string {
  const encodedPayload = Buffer.from(payload).toString('base64').replace(/=/g, '');
  const signature = "signature";
  return `snyk_uat.12345678.${encodedPayload}.${signature}`;
}
