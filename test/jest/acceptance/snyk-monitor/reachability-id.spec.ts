import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { getServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('--reachability-id', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = getServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      DEBUG: 'snyk*',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('forwards value to monitor graph endpoint', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    const { code } = await runSnykCLI('monitor --reachability-id=foo-bar', {
      env,
      cwd: project.path(),
    });
    expect(code).toEqual(0);

    const monitorRequests = server
      .getRequests()
      .filter((request) => /\/monitor\/[^/]+\/graph/.test(request.url));

    expect(monitorRequests.length).toBeGreaterThanOrEqual(1);
    monitorRequests.forEach((request) => {
      expect(request).toMatchObject({
        body: {
          reachabilityScanId: 'foo-bar',
        },
      });
    });
  });
});
