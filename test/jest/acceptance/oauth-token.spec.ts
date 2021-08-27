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
    const jsonObj = JSON.parse(await project.read('vulns-result.json'));
    server.setNextResponse(jsonObj);

    const { code } = await runSnykCLI(`test --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    server.requests.forEach((request) => {
      expect(request).toMatchObject({
        headers: {
          authorization: 'Bearer oauth-jwt-token',
        },
      });
    });
  });

  it('uses oauth token for authorised requests when monitoring projects', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    const jsonObj = JSON.parse(await project.read('vulns-result.json'));
    server.setNextResponse(jsonObj);

    const { code } = await runSnykCLI(`monitor --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    server.requests.forEach((request) => {
      expect(request).toMatchObject({
        headers: {
          authorization: 'Bearer oauth-jwt-token',
        },
      });
    });
  });
});
