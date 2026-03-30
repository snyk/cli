import * as path from 'path';
import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runCommand } from '../../util/runCommand';
import { runSnykCLI } from '../../util/runSnykCLI';

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
    const prerequisite = await runCommand('dotnet', ['--version']).catch(
      () => ({ code: 1, stderr: '', stdout: '' }),
    );

    if (prerequisite.code !== 0) {
      return;
    }

    server.setFeatureFlag('cliDotnetRuntimeResolution', true);

    const project = await createProjectFromWorkspace('nuget-app-6-no-rid');

    // dotnet restore is needed to generate obj/project.assets.json with valid
    // local paths — the plugin reads this file but does not create it.
    const restoreResult = await runCommand('dotnet', [
      'restore',
      path.resolve(project.path(), 'dotnet_6.csproj'),
    ]);

    if (restoreResult.code !== 0) {
      console.log(restoreResult.stdout);
      console.log(restoreResult.stderr);
    }
    expect(restoreResult.code).toBe(0);

    const { code, stdout } = await runSnykCLI('monitor', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).toContain('Monitoring');

    const featureFlagRequests = server
      .getRequests()
      .filter((req: any) =>
        req.url.includes('/feature-flags/cliDotnetRuntimeResolution'),
      );
    expect(featureFlagRequests.length).toBe(1);

    // Runtime resolution produces a dep graph, sent to /monitor/nuget/graph
    const monitorRequests = server
      .getRequests()
      .filter((req: any) => req.url.includes('/monitor/'));
    expect(monitorRequests.length).toBeGreaterThanOrEqual(1);
    expect(monitorRequests[0].url).toContain('/monitor/nuget/graph');
    expect(monitorRequests[0].body.depGraphJSON).toBeDefined();
  });

  test('nuget project uses legacy path when cliDotnetRuntimeResolution is disabled', async () => {
    const prerequisite = await runCommand('dotnet', ['--version']).catch(
      () => ({ code: 1, stderr: '', stdout: '' }),
    );

    if (prerequisite.code !== 0) {
      return;
    }

    const project = await createProjectFromWorkspace('nuget-app-6-no-rid');

    const restoreResult = await runCommand('dotnet', [
      'restore',
      path.resolve(project.path(), 'dotnet_6.csproj'),
    ]);

    if (restoreResult.code !== 0) {
      console.log(restoreResult.stdout);
      console.log(restoreResult.stderr);
    }
    expect(restoreResult.code).toBe(0);

    const { code, stdout } = await runSnykCLI('monitor', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).toContain('Monitoring');

    const featureFlagRequests = server
      .getRequests()
      .filter((req: any) =>
        req.url.includes('/feature-flags/cliDotnetRuntimeResolution'),
      );
    expect(featureFlagRequests.length).toBe(1);

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
