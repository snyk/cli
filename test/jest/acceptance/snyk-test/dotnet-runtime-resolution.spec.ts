import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';
import {
  assertDepGraph,
  parseDepGraphFromPrintGraphOutput,
  setupNugetProjectFromWorkspace,
} from '../../util/dotnetRuntimeResolution';

jest.setTimeout(1000 * 60 * 2);

describe('snyk test with cliDotnetRuntimeResolution feature flag', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const ipAddress = getFirstIPv4Address();
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: `http://${ipAddress}:${port}${baseApi}`,
      SNYK_HOST: `http://${ipAddress}:${port}`,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    } as Record<string, string>;
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await new Promise<void>((resolve) => server.listen(port, resolve));
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
  });

  test('feature flag enables dotnet runtime resolution path for nuget project', async () => {
    const project = await setupNugetProjectFromWorkspace(
      'nuget-app-6-no-rid',
      'dotnet_6.csproj',
    );

    server.setFeatureFlag('cliDotnetRuntimeResolution', true);

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    const depGraph = parseDepGraphFromPrintGraphOutput(stdout);
    assertDepGraph(depGraph, {
      expectedPackage: { name: 'DeepCloner', version: '0.10.4' },

      // System.Runtime package is resolved to the target framework version (6.x for net6.0).
      expectedRuntimeMajor: '6',
    });

    // SDK 11 lists meta-packages in its PackageOverrides.txt. They must keep their real
    // version rather than take the runtime's, which would be a version that doesn't exist.
    const netStandard = depGraph.pkgs.find(
      (p: any) => p.info.name === 'NETStandard.Library',
    );
    expect(netStandard?.info.version).toBe('1.6.1');
  });

  test('feature flag resolves a net11.0 project', async () => {
    const project = await setupNugetProjectFromWorkspace(
      'nuget-app-11',
      'dotnet_11.csproj',
    );

    server.setFeatureFlag('cliDotnetRuntimeResolution', true);

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    const depGraph = parseDepGraphFromPrintGraphOutput(stdout);
    expect(depGraph.pkgManager.name).toBe('nuget');
    const names = depGraph.pkgs.map((p: any) => p.info.name);
    expect(names).toContain('DeepCloner');
    expect(
      depGraph.pkgs.find((p: any) => p.info.name === 'DeepCloner').info.version,
    ).toBe('0.10.4');

    // SDK 11 prunes packages the shared framework supplies, so none reach the graph.
    expect(names).not.toContain('System.Runtime');
    expect(names).not.toContain('NETStandard.Library');
  });

  test('nuget project uses legacy path when cliDotnetRuntimeResolution is disabled', async () => {
    const project = await setupNugetProjectFromWorkspace(
      'nuget-app-6-no-rid',
      'dotnet_6.csproj',
    );

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    const depGraph = parseDepGraphFromPrintGraphOutput(stdout);
    assertDepGraph(depGraph, {
      expectedPackage: { name: 'DeepCloner', version: '0.10.4' },

      // System.Runtime package is resolved to the older NuGet package version (4.x) from project.assets.json.
      expectedRuntimeMajor: '4',
    });
  });
});
