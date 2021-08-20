import { fakeServer } from '../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('test using OAuth token', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = process.env.PORT || process.env.SNYK_PORT || '12345';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + apiPort + apiPath,
      SNYK_TOKEN: '123456789',
      SNYK_OAUTH_TOKEN: 'oauth-jwt-token',
    };

    server = fakeServer(apiPath, env.SNYK_TOKEN);
    server.listen(apiPort, () => done());
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('successfully tests a project with an OAuth env variable set', async () => {
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

  it('successfully monitors a project with an OAuth env variable set', async () => {
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
});
