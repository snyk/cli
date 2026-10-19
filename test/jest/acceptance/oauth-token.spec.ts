import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';
import { getServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('OAuth Token', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = getServerPort(process);
    env = {
      ...process.env,
      // Use a non-loopback address so requests go through the CLI proxy,
      // which adds the OAuth token. The legacy CLI never receives it.
      SNYK_API: 'http://' + getFirstIPv4Address() + ':' + apiPort + apiPath,
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      SNYK_OAUTH_TOKEN: 'oauth-jwt-token',
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

  it('uses oauth token for authorised requests when testing projects', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    server.setCustomResponse(await project.readJSON('vulns-result.json'));

    const { code } = await runSnykCLI(`test --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    server.getRequests().forEach((request) => {
      expect(request).toMatchObject({
        headers: {
          authorization: 'Bearer oauth-jwt-token',
        },
      });
    });
  });

  it('uses oauth token for authorised requests when monitoring projects', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    server.setCustomResponse(await project.readJSON('vulns-result.json'));

    const { code } = await runSnykCLI(`monitor --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    server.getRequests().forEach((request) => {
      expect(request).toMatchObject({
        headers: {
          authorization: 'Bearer oauth-jwt-token',
        },
      });
    });
  });
});
