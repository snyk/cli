import { fakeServer } from '../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('OAuth Token', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = process.env.PORT || process.env.SNYK_PORT || '12345';
    env = {
      PATH: process.env.PATH || '',
      SNYK_API: 'http://localhost:' + apiPort + apiPath,
      SNYK_OAUTH_TOKEN: 'oauth-jwt-token',
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

  it('uses oauth token when testing projects', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    const jsonObj = JSON.parse(await project.read('vulns-result.json'));
    server.setNextResponse(jsonObj);

    const { code } = await runSnykCLI(`test --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    const requests = server.popRequests(2);
    expect(requests[0].headers.authorization).toBe('Bearer oauth-jwt-token');
    expect(requests[0].method).toBe('POST');
  });

  it('uses oauth token when monitoring projects', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    const jsonObj = JSON.parse(await project.read('vulns-result.json'));
    server.setNextResponse(jsonObj);

    const { code } = await runSnykCLI(`monitor --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    const requests = server.popRequests(2);
    expect(requests[0].headers.authorization).toBe('Bearer oauth-jwt-token');
    expect(requests[0].method).toBe('PUT');
  });

  it('uses oauth token when fetching feature flags', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    const jsonObj = JSON.parse(await project.read('vulns-result.json'));
    server.setNextResponse(jsonObj);

    const expectedUrl =
      '/api/v1/cli-config/feature-flags/experimentalDepGraph?org=test-org';

    /**
     * The --experimental-dep-graph isn't actually needed for triggering the
     * experimentalDepGraph feature flag check. Which might be a bug. I've put
     * it here to show intent despite us not really needing it.
     */
    await runSnykCLI(`monitor --experimental-dep-graph --org=test-org`, {
      cwd: project.path(),
      env,
    });

    expect(server.requests.map((r) => r.url)).toContain(expectedUrl);

    const request = server.requests.filter((r) => r.url === expectedUrl)[0];
    expect(request.headers.authorization).toBe('Bearer oauth-jwt-token');
  });
});
