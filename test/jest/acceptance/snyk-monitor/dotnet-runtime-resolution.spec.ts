import * as path from 'path';
import { fakeServer } from '../../../acceptance/fake-server';
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
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
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

    const { code, stdout, stderr } = await runSnykCLI('monitor -d', {
      cwd: project.path(),
      env,
    });

    if (code !== 0) {
      console.debug('stderr:', stderr);
      console.debug('stdout:', stdout);
    }

    expect(code).toEqual(0);
    expect(stdout).toContain('Monitoring');

    // Verify the CLI recognised the feature flag and activated runtime resolution
    expect(stderr).toContain(
      'cliDotnetRuntimeResolution feature flag is enabled',
    );
    // This debug line is emitted by the nuget plugin only when
    // buildDepGraphFromFiles is called (the runtime-resolution code path)
    expect(stderr).toContain('running dotnet command: version: dotnet');

    const featureFlagRequests = server
      .getRequests()
      .filter((req: any) =>
        req.url.includes('/feature-flags/cliDotnetRuntimeResolution'),
      );
    expect(featureFlagRequests.length).toBe(1);

    const monitorRequests = server
      .getRequests()
      .filter((req: any) => req.url.includes('/monitor/'));
    expect(monitorRequests.length).toBeGreaterThanOrEqual(1);
  });

  test('nuget project uses standard path when cliDotnetRuntimeResolution is disabled', async () => {
    const project = await createProjectFromWorkspace('nuget-app-2');

    const { code, stdout, stderr } = await runSnykCLI('monitor -d', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).toContain('Monitoring');

    // Verify runtime-resolution was NOT activated
    expect(stderr).not.toContain(
      'cliDotnetRuntimeResolution feature flag is enabled',
    );
    expect(stderr).not.toContain('running dotnet command: version: dotnet');
  });
});
