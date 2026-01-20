import { fakeServer } from '../../../acceptance/fake-server';
import { createProject } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';
import { DepGraphBuilder } from '@snyk/dep-graph';
import * as pluginsModule from '../../../../src/lib/plugins/index';

jest.setTimeout(1000 * 60);

describe('snyk monitor uv', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string | undefined>;
  let loadPluginSpy: jest.SpyInstance;
  const originalLoadPlugin = pluginsModule.loadPlugin;

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
  });

  afterEach(() => {
    if (loadPluginSpy) {
      loadPluginSpy.mockRestore();
    }
  });

  afterAll(async () => {
    await server.closePromise();
  });

  it('monitors uv project successfully', async () => {
    const project = await createProject('uv-acceptance');

    // Build a mock dependency graph similar to what uv would return
    const depGraphBuilder = new DepGraphBuilder(
      { name: 'pip' },
      { name: 'demo', version: '0.1.0' },
    );

    depGraphBuilder.addPkgNode(
      { name: 'requests', version: '2.31.0' },
      'requests@2.31.0',
    );

    depGraphBuilder.addPkgNode(
      { name: 'urllib3', version: '2.0.7' },
      'urllib3@2.0.7',
    );

    depGraphBuilder.addPkgNode(
      { name: 'certifi', version: '2026.1.4' },
      'certifi@2026.1.4',
    );

    depGraphBuilder.addPkgNode(
      { name: 'charset-normalizer', version: '3.4.4' },
      'charset-normalizer@3.4.4',
    );

    depGraphBuilder.connectDep('root-node', 'requests@2.31.0');
    depGraphBuilder.connectDep('root-node', 'urllib3@2.0.7');
    depGraphBuilder.connectDep('requests@2.31.0', 'certifi@2026.1.4');
    depGraphBuilder.connectDep('requests@2.31.0', 'charset-normalizer@3.4.4');
    depGraphBuilder.connectDep('requests@2.31.0', 'urllib3@2.0.7');

    const dependencyGraph = depGraphBuilder.build();

    // Mock the uv plugin to return our dependency graph
    const mockPlugin = {
      async inspect() {
        return {
          plugin: {
            name: 'bundled:uv',
            runtime: 'unknown',
            packageManager: 'pip',
          },
          scannedProjects: [
            {
              depGraph: dependencyGraph,
              meta: {
                targetFile: 'uv.lock',
                packageManager: 'pip',
              },
            },
          ],
        };
      },
    };

    // Mock loadPlugin to return our mock plugin for 'uv'
    loadPluginSpy = jest
      .spyOn(pluginsModule, 'loadPlugin')
      .mockImplementation((packageManager) => {
        if (packageManager === 'uv') {
          return mockPlugin as any;
        }
        // For other package managers, use the original implementation
        return originalLoadPlugin(packageManager);
      });

    const { code } = await runSnykCLI('monitor', {
      env,
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

    // Verify root package
    const rootPkg = depGraphJSON.pkgs.find(
      (pkg: any) => pkg.info.name === 'demo',
    );
    expect(rootPkg).toBeDefined();
    expect(rootPkg.info.version).toBe('0.1.0');

    // Verify dependencies are included
    const requestsPkg = depGraphJSON.pkgs.find(
      (pkg: any) => pkg.info.name === 'requests',
    );
    expect(requestsPkg).toBeDefined();

    // Verify target file is sent (either targetFile or targetFileRelativePath)
    expect(
      monitorRequest?.body.targetFile === 'uv.lock' ||
        monitorRequest?.body.targetFileRelativePath?.endsWith('uv.lock'),
    ).toBe(true);
  });
});
