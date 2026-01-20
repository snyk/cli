import { fakeServer } from '../../../acceptance/fake-server';
import { createProject } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('snyk monitor uv', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string | undefined>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';
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

    // Enable UV feature flag
    server.setFeatureFlag('enableUvCLI', true);
  });

  beforeEach(() => {
    server.restore();
    // Re-enable feature flag after restore
    server.setFeatureFlag('enableUvCLI', true);
  });

  afterAll(async () => {
    await server.closePromise();
  });

  it('monitors uv project successfully', async () => {
    const project = await createProject('uv-acceptance');

    // Set SNYK_INTERNAL_PARENT_APPLICATION to point to the CLI binary under test
    // This allows the uv plugin to execute the CLI's depgraph command
    // The TEST_SNYK_COMMAND env var contains the path to the CLI binary being tested
    const cliPath = process.env.TEST_SNYK_COMMAND;
    if (!cliPath) {
      throw new Error(
        'TEST_SNYK_COMMAND not set - uv monitor test requires the CLI binary path',
      );
    }

    const testEnv = {
      ...env,
      SNYK_INTERNAL_PARENT_APPLICATION: cliPath,
    };

    const { code } = await runSnykCLI('monitor', {
      env: testEnv,
      cwd: project.path(),
    });

    expect(code).toEqual(0);

    // Get all monitor requests
    const monitorRequests = server
      .getRequests()
      .filter((request) => request.url?.includes('/monitor/'));

    expect(monitorRequests.length).toBeGreaterThanOrEqual(1);

    // Find the monitor request for pip/uv
    const monitorRequest = monitorRequests.find(
      (req) => req.url?.includes('/monitor/pip/graph'),
    );

    expect(monitorRequest).toBeDefined();
    expect(monitorRequest?.method).toBe('PUT');
    expect(monitorRequest?.body).toBeDefined();
    expect(monitorRequest?.body.depGraphJSON).toBeDefined();

    // Verify dependency graph structure
    const depGraphJSON = monitorRequest?.body.depGraphJSON;
    expect(depGraphJSON).toBeDefined();
    expect(depGraphJSON.pkgs).toBeDefined();
    expect(Array.isArray(depGraphJSON.pkgs)).toBe(true);

    // Verify root package exists (name from pyproject.toml)
    const rootPkg = depGraphJSON.pkgs.find(
      (pkg: any) => pkg.info.name === 'demo',
    );
    expect(rootPkg).toBeDefined();

    // Verify target file is sent (either targetFile or targetFileRelativePath)
    expect(
      monitorRequest?.body.targetFile === 'uv.lock' ||
        monitorRequest?.body.targetFileRelativePath?.endsWith('uv.lock'),
    ).toBe(true);
  });
});
