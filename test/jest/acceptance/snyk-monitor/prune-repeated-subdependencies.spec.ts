import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { getServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('monitor with --prune-repeated-subdependencies', () => {
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

  it('prunes graph and omits prePruneDepCount on the prune path', async () => {
    const project = await createProjectFromWorkspace('npm-package');
    const { code } = await runSnykCLI('monitor -p', {
      env,
      cwd: project.path(),
    });
    expect(code).toEqual(0);

    const monitorRequest = server
      .getRequests()
      .find((request) => /\/monitor\/npm\/graph/.test(request.url));

    expect(monitorRequest).toBeDefined();
    expect(monitorRequest?.body.depGraphJSON).toBeDefined();
    expect(monitorRequest?.body.meta.monitorGraph).toBe(true);
    expect(monitorRequest?.body.meta.prePruneDepCount).toBeUndefined();
  });
});
