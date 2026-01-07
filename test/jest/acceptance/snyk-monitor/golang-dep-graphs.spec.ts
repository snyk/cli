import { runSnykCLI } from '../../util/runSnykCLI';
import { FakeServer, fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { getServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('gomodules dep-graphs', () => {
  let server: FakeServer;
  let env: Record<string, string>;

  beforeAll(() => {
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
    return new Promise<void>((res) => {
      server.listen(port, res);
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(() => {
    return new Promise<void>((res) => server.close(res));
  });

  it('includes PackageURLs in gomodules dep-graphs', async () => {
    const project = await createProjectFromWorkspace(
      'golang-gomodules-many-deps',
    );
    const { code } = await runSnykCLI('monitor', {
      env,
      cwd: project.path(),
    });
    expect(code).toEqual(0);

    const monitorRequest = server
      .getRequests()
      .find((request) => /\/monitor\/[^/]+\/graph/.test(request.url));

    expect(monitorRequest).toBeDefined();

    for (const pkg of monitorRequest?.body.depGraphJSON.pkgs) {
      expect(pkg.info.purl).toBeDefined();
    }
  });
});
