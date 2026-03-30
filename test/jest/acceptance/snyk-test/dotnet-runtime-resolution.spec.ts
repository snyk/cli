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

function parseDepGraphFromPrintGraphOutput(stdout: string) {
  const start = stdout.indexOf('DepGraph data:');
  const end = stdout.indexOf('DepGraph target:', start);
  if (start === -1 || end === -1) {
    throw new Error('--print-graph output did not contain expected markers');
  }
  const jsonStr = stdout.substring(start + 'DepGraph data:'.length, end);
  return JSON.parse(jsonStr);
}

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
    const prerequisite = await runCommand('dotnet', ['--version']).catch(
      () => ({ code: 1, stderr: '', stdout: '' }),
    );

    if (prerequisite.code !== 0) {
      return;
    }

    server.setFeatureFlag('cliDotnetRuntimeResolution', true);

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

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    const depGraph = parseDepGraphFromPrintGraphOutput(stdout);
    expect(depGraph.pkgManager.name).toBe('nuget');

    const deepCloner = depGraph.pkgs.find(
      (p: any) => p.info.name === 'DeepCloner',
    );
    expect(deepCloner).toBeDefined();
    expect(deepCloner.info.version).toBe('0.10.4');

    // Runtime resolution maps framework packages to the target framework
    // version (6.x for net6.0) rather than the older NuGet package versions (4.x)
    const systemRuntime = depGraph.pkgs.find(
      (p: any) => p.info.name === 'System.Runtime',
    );
    expect(systemRuntime).toBeDefined();
    expect(systemRuntime.info.version).toMatch(/^6\./);
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

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    const depGraph = parseDepGraphFromPrintGraphOutput(stdout);
    expect(depGraph.pkgManager.name).toBe('nuget');

    const deepCloner = depGraph.pkgs.find(
      (p: any) => p.info.name === 'DeepCloner',
    );
    expect(deepCloner).toBeDefined();
    expect(deepCloner.info.version).toBe('0.10.4');

    // Without runtime resolution, framework packages retain the older NuGet
    // package versions (4.x) from project.assets.json
    const systemRuntime = depGraph.pkgs.find(
      (p: any) => p.info.name === 'System.Runtime',
    );
    expect(systemRuntime).toBeDefined();
    expect(systemRuntime.info.version).toMatch(/^4\./);
  });
});
