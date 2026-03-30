import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';
import {
  assertDepGraph,
  setupNugetProjectFromWorkspace,
} from '../../util/dotnetRuntimeResolution';

jest.setTimeout(1000 * 60 * 2);

describe('snyk monitor with cliDotnetRuntimeResolution feature flag', () => {
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

    const { code } = await runSnykCLI('monitor', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    // Runtime resolution sends a dep graph to /monitor/nuget/graph
    const monitorRequests = server
      .getRequests()
      .filter((req: any) => req.url.includes('/monitor/'));
    expect(monitorRequests.length).toBeGreaterThanOrEqual(1);
    expect(monitorRequests[0].url).toContain('/monitor/nuget/graph');

    const depGraph = monitorRequests[0].body.depGraphJSON;
    expect(depGraph).toBeDefined();
    assertDepGraph(depGraph, {
      expectedPackage: { name: 'DeepCloner', version: '0.10.4' },
      expectedRuntimeMajor: '6',
    });
  });

  test('nuget project uses legacy path when cliDotnetRuntimeResolution is disabled', async () => {
    const project = await setupNugetProjectFromWorkspace(
      'nuget-app-6-no-rid',
      'dotnet_6.csproj',
    );

    const { code } = await runSnykCLI('monitor', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    // Without runtime resolution the legacy path sends a dep tree (not a
    // dep graph) to /monitor/nuget
    const monitorRequests = server
      .getRequests()
      .filter((req: any) => req.url.includes('/monitor/'));
    expect(monitorRequests.length).toBeGreaterThanOrEqual(1);
    expect(monitorRequests[0].url).toContain('/monitor/nuget');
    expect(monitorRequests[0].url).not.toContain('/monitor/nuget/graph');
    expect(monitorRequests[0].body.package).toBeDefined();
    expect(monitorRequests[0].body.depGraphJSON).toBeUndefined();
  });
});
