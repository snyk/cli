import { runSnykCLI } from '../../util/runSnykCLI';
import { FakeServer, fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromFixture } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('uv monitor', () => {
  let server: FakeServer;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
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

  // NOTE: these tests will need updating once the uv plugin stops returning
  // the hardcoded dep-graph `STUB_DEP_GRAPH_DATA` in src/lib/plugins/uv/index.ts.
  it('sends the expected dep-graph to the monitor endpoint', async () => {
    server.setFeatureFlag('enableUvCLI', true);

    const project = await createProjectFromFixture('uv-project');

    const { code, stdout } = await runSnykCLI('monitor --file=uv.lock', {
      env: { ...env, SNYK_INTERNAL_UV_MONITOR_ENABLED: 'true' },
      cwd: project.path(),
    });

    expect(code).toEqual(0);
    expect(stdout).toContain('Monitoring');

    const monitorRequests = server
      .getRequests()
      .filter((request) => /\/monitor\/[^/]+\/graph/.test(request.url));

    expect(monitorRequests).toHaveLength(1);

    const depGraphJSON = monitorRequests[0].body.depGraphJSON;
    expect(depGraphJSON).toBeDefined();

    expect(depGraphJSON.pkgManager.name).toBe('pip');

    const rootPkg = depGraphJSON.pkgs.find(
      (p: any) => p.id === 'uv-project@0.1.0',
    );
    expect(rootPkg).toBeDefined();
    expect(rootPkg.info).toEqual({ name: 'uv-project', version: '0.1.0' });

    const depNames = depGraphJSON.pkgs.map((p: any) => p.info.name).sort();
    expect(depNames).toEqual(['cffi', 'cryptography', 'urllib3', 'uv-project']);

    const rootNode = depGraphJSON.graph.nodes.find(
      (n: any) => n.nodeId === 'root-node',
    );
    expect(rootNode).toBeDefined();
    expect(rootNode.deps).toEqual(
      expect.arrayContaining([
        { nodeId: 'urllib3@1.26.15' },
        { nodeId: 'cryptography@40.0.0' },
      ]),
    );

    const cryptoNode = depGraphJSON.graph.nodes.find(
      (n: any) => n.nodeId === 'cryptography@40.0.0',
    );
    expect(cryptoNode).toBeDefined();
    expect(cryptoNode.deps).toEqual([{ nodeId: 'cffi@2.0.0' }]);
  });

  it('does not monitor uv projects when the feature flag is disabled', async () => {
    server.setFeatureFlag('enableUvCLI', false);

    const project = await createProjectFromFixture('uv-project');

    const { code } = await runSnykCLI('monitor --file=uv.lock', {
      env: { ...env, SNYK_INTERNAL_UV_MONITOR_ENABLED: 'true' },
      cwd: project.path(),
    });

    expect(code).not.toEqual(0);

    const monitorRequests = server
      .getRequests()
      .filter((request) => /\/monitor\/[^/]+\/graph/.test(request.url));

    expect(monitorRequests).toHaveLength(0);
  });

  it('does not monitor uv projects when the env var is not set', async () => {
    server.setFeatureFlag('enableUvCLI', true);

    const project = await createProjectFromFixture('uv-project');

    const { code } = await runSnykCLI('monitor --file=uv.lock', {
      env,
      cwd: project.path(),
    });

    expect(code).not.toEqual(0);

    const monitorRequests = server
      .getRequests()
      .filter((request) => /\/monitor\/[^/]+\/graph/.test(request.url));

    expect(monitorRequests).toHaveLength(0);
  });

  it('does not monitor uv projects when both feature flag and env var are disabled', async () => {
    server.setFeatureFlag('enableUvCLI', false);

    const project = await createProjectFromFixture('uv-project');

    const { code } = await runSnykCLI('monitor --file=uv.lock', {
      env,
      cwd: project.path(),
    });

    expect(code).not.toEqual(0);

    const monitorRequests = server
      .getRequests()
      .filter((request) => /\/monitor\/[^/]+\/graph/.test(request.url));

    expect(monitorRequests).toHaveLength(0);
  });
});
