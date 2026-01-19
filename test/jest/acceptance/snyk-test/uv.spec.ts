import { FakeServer, fakeServer } from '../../../acceptance/fake-server';
import { createProject } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';

type DepGraph = {
  pkgs?: Array<{ info?: { name?: string } }>;
};

jest.setTimeout(1000 * 60);

describe('uv lock acceptance', () => {
  let server: FakeServer;
  let env: Record<string, string | undefined>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/v1';
    const apiBase = 'http://localhost:' + port;
    env = {
      ...process.env,
      SNYK_API: apiBase + baseApi,
      SNYK_HOST: apiBase,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN as string);

    await server.listenPromise(port);
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await server.closePromise();
  });

  test('routes uv.lock through unified test API when feature flag is enabled', async () => {
    server.setFeatureFlag('enableUvCLI', true);

    const project = await createProject('uv-acceptance');
    const { code } = await runSnykCLI('test --json', {
      cwd: project.path(),
      env: {
        ...env,
        XDG_CONFIG_HOME: project.path(),
      },
    });

    expect(code).toEqual(0);

    const requests = server.getRequests();
    const paths = requests.map((req) => req.path);
    const orgId = '55555555-5555-5555-5555-555555555555';
    const testJobId = 'aaaaaaaa-bbbb-cccc-dddd-000000000001';
    const testId = 'aaaaaaaa-bbbb-cccc-dddd-000000000002';

    expect(paths).toContain('/v1/cli-config/feature-flags/enableUvCLI');
    expect(paths).toContain(`/rest/orgs/${orgId}/tests`);
    expect(paths).toContain(`/rest/orgs/${orgId}/test_jobs/${testJobId}`);
    expect(paths).toContain(`/rest/orgs/${orgId}/tests/${testId}`);
    expect(paths).toContain(`/rest/orgs/${orgId}/tests/${testId}/findings`);

    const createTestReq = requests.find(
      (req) =>
        req.method === 'POST' && req.path === `/rest/orgs/${orgId}/tests`,
    );
    expect(createTestReq).toBeDefined();
    const depGraph: DepGraph =
      createTestReq?.body?.data?.attributes?.subject?.dep_graph;
    expect(depGraph).toBeDefined();
    const pkgNames = (depGraph.pkgs || []).map((p) => p.info?.name);
    expect(pkgNames.length).toBeGreaterThan(0);
  });

  test('does not attempt to test a uv.lock file when the uv feature flag is disabled', async () => {
    server.setFeatureFlag('enableUvCLI', false);

    const project = await createProject('uv-acceptance');
    const { code, stdout } = await runSnykCLI('test --json', {
      cwd: project.path(),
      env: {
        ...env,
        XDG_CONFIG_HOME: project.path(),
      },
    });

    // Exit code 3: Could not detect supported target files
    expect(code).toEqual(3);

    const result = JSON.parse(stdout);
    expect(result.error).toContain('Could not detect supported target files');

    const requests = server.getRequests();
    const paths = requests.map((req) => req.path);
    const orgId = '55555555-5555-5555-5555-555555555555';

    // Should check the feature flag as we do have a uv.lock file
    expect(paths).toContain('/v1/cli-config/feature-flags/enableUvCLI');

    // Should NOT use the unified test API or SBOM conversion
    expect(paths).not.toContain(`/rest/orgs/${orgId}/tests`);
    expect(paths).not.toContain(`/hidden/orgs/${orgId}/sboms/convert`);
  });
});
