import {
  createProjectFromFixture,
  createProjectFromWorkspace,
} from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { runCommand } from '../../util/runCommand';
import { isDontSkipTestsEnabled } from '../../util/isDontSkipTestsEnabled';
import { getServerPort } from '../../util/getServerPort';
import * as path from 'path';

jest.setTimeout(1000 * 60);

const getOrgSlug = () => {
  const orgSlug = process.env.TEST_SNYK_ORG_SLUGNAME;

  if (!orgSlug) {
    throw 'No TEST_SNYK_ORG_SLUGNAME env variable set';
  }

  return orgSlug;
};

describe('`snyk test` of basic projects for each language/ecosystem', () => {
  let server;
  let env: Record<string, string>;
  let dontSkip: boolean;

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
    dontSkip = isDontSkipTestsEnabled();
    console.debug("Don't skip tests: " + dontSkip);
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  test('run `snyk test` on a go project and ensure that required modules are not cached', async () => {
    const project = await createProjectFromWorkspace('golang-gomodules');

    // clean cache
    const cleanupResult = await runCommand('go', ['clean', '-modcache'], {
      shell: true,
    });

    if (cleanupResult.code == 0) {
      console.debug('go cache cleaned ' + cleanupResult.code);
    } else {
      console.warn("Please ensure to install 'go' to run this test.");
    }

    const { code } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);
  });

  test.each([
    {
      fixture: 'pip-app',
    },
    {
      fixture: 'pip-app-robust',
    },
  ])('run `snyk test` on a python project $fixture', async ({ fixture }) => {
    const project = await createProjectFromWorkspace(fixture);
    let pythonCommand = 'python';

    await runCommand(pythonCommand, ['--version']).catch(function () {
      pythonCommand = 'python3';
    });

    console.debug('Using: ' + pythonCommand);
    let pipResult = await runCommand(
      pythonCommand,
      [
        '-m',
        'pip',
        'install',
        '-r',
        'requirements.txt',
        '--break-system-packages',
      ],
      {
        shell: true,
        cwd: project.path(),
      },
    );

    if (pipResult && pipResult.code != 0) {
      pipResult = await runCommand(
        pythonCommand,
        ['-m', 'pip', 'install', '-r', 'requirements.txt'],
        {
          shell: true,
          cwd: project.path(),
        },
      );
    }

    expect(pipResult.code).toEqual(0);

    const { code } = await runSnykCLI('test -d --command=' + pythonCommand, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
  });

  test('fails `snyk test` on a python project with wrong command exits with code 2', async () => {
    const project = await createProjectFromWorkspace('pip-app');
    let wrongPythonCommand = 'pthon';

    await runCommand(wrongPythonCommand, ['--version']).catch(function () {
      wrongPythonCommand = 'pthon3';
    });

    const result = await runSnykCLI('test -d --command=' + wrongPythonCommand, {
      cwd: project.path(),
      env,
    });

    expect(result.code).toEqual(2);
    expect(result.stderr).toMatch(wrongPythonCommand);
  });

  test('run `snyk test` on a pipenv project', async () => {
    const project = await createProjectFromWorkspace('pipenv-app');
    let pythonCommand = 'python';

    await runCommand(pythonCommand, ['--version']).catch(function () {
      pythonCommand = 'python3';
    });

    const pipenvResult = await runCommand('pipenv', ['install'], {
      shell: true,
      cwd: project.path(),
    });

    expect(pipenvResult.code).toEqual(0);

    const result = await runSnykCLI('test -d --command=' + pythonCommand, {
      cwd: project.path(),
      env,
    });

    expect(result.code).toEqual(0);
  });

  test('run `snyk test` on a gradle project', async () => {
    const project = await createProjectFromWorkspace('gradle-app');

    const { code, stderr, stdout } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env,
    });

    if (code != 0) {
      console.debug(stderr);
      console.debug('---------------------------');
      console.debug(stdout);
    }

    expect(code).toEqual(0);
  });

  test('run `snyk test` on a gradle project and check top-level dependency node id', async () => {
    const project = await createProjectFromWorkspace('gradle-with-classifier');

    const { code, stderr, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    if (code != 0) {
      console.debug(stderr);
      console.debug('---------------------------');
      console.debug(stdout);
    }
    expect(code).toEqual(0);

    const depGraphJsonStr = stdout
      .split('DepGraph data:')[1]
      .split('DepGraph target:')[0];
    const depGraphJson = JSON.parse(depGraphJsonStr);
    expect(depGraphJson.pkgManager.name).toEqual('gradle');
    expect(depGraphJson.pkgs).toContainEqual({
      id: 'net.sf.json-lib:json-lib@2.4',
      info: { name: 'net.sf.json-lib:json-lib', version: '2.4' },
    });
    expect(depGraphJson.graph.nodes).toContainEqual({
      nodeId: 'net.sf.json-lib:json-lib:jar:jdk13@2.4',
      pkgId: 'net.sf.json-lib:json-lib@2.4',
      deps: expect.any(Array),
    });
  });

  test('run `snyk test` on a cocoapods project', async () => {
    const project = await createProjectFromWorkspace('cocoapods-app');

    const { code } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
  });

  test('run `snyk test` on a maven project', async () => {
    const project = await createProjectFromWorkspace('maven-app');

    const { code } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
  });

  test('run `snyk test` on a nuget project', async () => {
    const project = await createProjectFromWorkspace('nuget-app-2');

    const { code } = await runSnykCLI('test -d', {
      cwd: project.path(),
    });

    expect(code).toEqual(0);
  });

  test.each([
    {
      fixture: 'nuget-app-6',
      targetFile: 'dotnet_6.csproj',
    },
    {
      fixture: 'nuget-app-6-no-rid',
      targetFile: 'dotnet_6.csproj',
    },
    {
      fixture: 'nuget-app-7-windows',
      targetFile: 'dotnet_7.csproj',
    },
    {
      fixture: 'nuget-app-netstandard20',
      targetFile: 'netstandard20.csproj',
    },
    {
      fixture: 'nuget-app-8-with-azure-functions',
      targetFile: 'dotnet_8_with_azure_functions.csproj',
    },
    {
      fixture: 'nuget-app-8-with-multi-project and spaces',
      targetFile: 'dotnet_8_first.csproj',
    },
    {
      fixture: 'nuget-app-9-globaljson',
      targetFile: 'dotnet_9.csproj',
    },
  ])(
    'run `snyk test` on a nuget project using v2 dotnet runtime resolution logic for $fixture',
    async ({ fixture, targetFile }) => {
      let prerequisite = await runCommand('dotnet', ['--version']).catch(
        function () {
          return { code: 1, stderr: '', stdout: '' };
        },
      );

      if (prerequisite.code !== 0) {
        return;
      }

      const project = await createProjectFromWorkspace(fixture);

      prerequisite = await runCommand('dotnet', [
        'restore',
        `"${path.resolve(project.path(), targetFile)}"`,
      ]);

      if (prerequisite.code !== 0) {
        console.log(prerequisite.stdout);
        console.log(prerequisite.stderr);
        throw new Error(prerequisite.stdout);
      }

      const { code, stderr, stdout } = await runSnykCLI(
        'test --dotnet-runtime-resolution --json',
        {
          cwd: project.path(),
        },
      );

      // Debug output on an unexpected exit code
      if (code !== 0 && code !== 1) {
        console.debug(stderr);
        console.debug('---------------------------');
        console.debug(stdout);
      }

      // Expect an exit code of 0 or 1. Exit code 1 is possible if a new
      // vulnerability is discovered in the installed version of dotnet's system
      // libraries.
      expect([0, 1]).toContain(code);

      // Checking if the JSON output is correctly defined and is not poluted with user facing messages.
      const result = JSON.parse(stdout);
      expect(result?.ok).toBeDefined();

      // Expect 'ok' to be true if exit 0, false if exit 1.
      expect(result.ok).toBe(code === 0);
    },
  );

  it('run `snyk test` on a .net framework project using v3 dotnet runtime resolution logic', async () => {
    server.setFeatureFlag('useImprovedDotnetWithoutPublish', true);

    let prerequisite = await runCommand('dotnet', ['--version']).catch(
      function () {
        return { code: 1, stderr: '', stdout: '' };
      },
    );

    if (prerequisite.code !== 0) {
      return;
    }

    const project = await createProjectFromWorkspace('nuget-app-net48');

    prerequisite = await runCommand('dotnet', [
      'restore',
      `"${path.resolve(project.path(), 'net48.csproj')}"`,
    ]);

    if (prerequisite.code !== 0) {
      console.log(prerequisite.stdout);
      console.log(prerequisite.stderr);
      throw new Error(prerequisite.stdout);
    }

    const { code, stderr, stdout } = await runSnykCLI(
      'test --dotnet-runtime-resolution --json',
      {
        cwd: project.path(),
        env,
      },
    );

    // Debug output on an unexpected exit code
    if (code !== 0 && code !== 1) {
      console.debug(stderr);
      console.debug('---------------------------');
      console.debug(stdout);
    }

    // Expect an exit code of 0 or 1. Exit code 1 is possible if a new
    // vulnerability is discovered in the installed version of dotnet's system
    // libraries.
    expect([0, 1]).toContain(code);

    // Checking if the JSON output is correctly defined and is not poluted with user facing messages.
    const result = JSON.parse(stdout);
    expect(result?.ok).toBeDefined();

    // Expect 'ok' to be true if exit 0, false if exit 1.
    expect(result.ok).toBe(code === 0);
  });

  test('run `snyk test` on a nuget project using v2 dotnet runtime resolution logic with a custom output path', async () => {
    let prerequisite = await runCommand('dotnet', ['--version']).catch(
      function () {
        return { code: 1, stderr: '', stdout: '' };
      },
    );

    if (prerequisite.code !== 0) {
      return;
    }

    const fixtureName = 'nuget-app-8-custom-output-path';

    const project = await createProjectFromWorkspace(fixtureName);

    prerequisite = await runCommand('dotnet', [
      'restore',
      `${path.resolve(project.path(), 'program.csproj')}`,
    ]);

    if (prerequisite.code !== 0) {
      console.log(prerequisite.stdout);
      console.log(prerequisite.stderr);
      throw new Error(prerequisite.stdout);
    }

    const { code, stderr, stdout } = await runSnykCLI(
      'test -d --dotnet-runtime-resolution --file=random-output/company/obj/project.assets.json',
      {
        cwd: project.path(),
      },
    );

    if (code !== 0) {
      console.debug(stderr);
      console.debug('---------------------------');
      console.debug(stdout);
    }

    expect(code).toEqual(0);
  });

  test.each([
    {
      targetFramework: 'net6.0',
    },
    {
      targetFramework: 'net7.0',
    },
    {
      targetFramework: 'net8.0',
    },
    {
      targetFramework: undefined,
    },
  ])(
    'run `snyk test` on a nuget project using v2 dotnet runtime resolution logic with explicit target framework $targetFramework',
    async ({ targetFramework }) => {
      let prerequisite = await runCommand('dotnet', ['--version']).catch(
        function () {
          return { code: 1, stderr: '', stdout: '' };
        },
      );

      if (prerequisite.code !== 0) {
        return;
      }

      const fixtureName = 'nuget-app-6-7-8';
      const project = await createProjectFromWorkspace(fixtureName);

      prerequisite = await runCommand('dotnet', [
        'restore',
        `"${project.path()}"`,
      ]);

      if (prerequisite.code !== 0) {
        console.log(prerequisite.stdout);
        console.log(prerequisite.stderr);
        throw new Error(prerequisite.stdout);
      }

      let command = 'test -d --dotnet-runtime-resolution';
      if (targetFramework) {
        command = `test -d --dotnet-runtime-resolution --dotnet-target-framework=${targetFramework}`;
      }

      const { code, stderr, stdout } = await runSnykCLI(command, {
        cwd: project.path(),
      });

      if (code !== 0) {
        console.debug(stderr);
        console.debug('---------------------------');
        console.debug(stdout);
      }

      expect(code).toEqual(0);
    },
  );

  test.skip('run `snyk test` on an unmanaged project', async () => {
    const project = await createProjectFromWorkspace('unmanaged');

    const { code } = await runSnykCLI('test --unmanaged -d', {
      cwd: project.path(),
    });

    expect(code).toEqual(1);
  });

  test.skip('run `snyk test` on an unmanaged project with a org-slug', async () => {
    const project = await createProjectFromWorkspace('unmanaged');

    const { code } = await runSnykCLI(
      `test --unmanaged --org=${getOrgSlug()} -d`,
      {
        cwd: project.path(),
      },
    );

    expect(code).toEqual(1);
  });

  test('run `snyk test` on an unmanaged project with purls', async () => {
    const project = await createProjectFromWorkspace('unmanaged');

    const { stdout } = await runSnykCLI(`test --unmanaged -d`, {
      cwd: project.path(),
    });

    stdout.includes('purl: pkg:generic/zlib@');
  });

  test('run `snyk test --json` on an unmanaged project with purls', async () => {
    const project = await createProjectFromWorkspace('unmanaged');

    const { stdout } = await runSnykCLI(`test --unmanaged -d --json`, {
      cwd: project.path(),
    });

    stdout.includes('"purl": "pkg:generic/zlib@');
  });

  test('run `snyk test` on a hex project', async () => {
    const prerequisite = await runCommand('mix', ['--version']).catch(
      function () {
        return { code: 1, stderr: '', stdout: '' };
      },
    );
    if (prerequisite.code == 0 || dontSkip) {
      const project = await createProjectFromWorkspace('hex-app');

      const { code } = await runSnykCLI('test -d', {
        cwd: project.path(),
        env,
      });

      expect(code).toEqual(0);
    } else {
      console.warn('mix not found, skipping test!');
    }
  });

  test('run `snyk test` on a composer project', async () => {
    const prerequisite = await runCommand('composer', ['--version']).catch(
      function () {
        return { code: 1, stderr: '', stdout: '' };
      },
    );
    if (prerequisite.code == 0 || dontSkip) {
      const project = await createProjectFromWorkspace('composer-app');

      const { code } = await runSnykCLI('test -d', {
        cwd: project.path(),
        env,
      });

      expect(code).toEqual(0);
    } else {
      console.warn('composer not found, skipping test!');
    }
  });

  test('run `snyk test` on a sbt project', async () => {
    const prerequisite = await runCommand('sbt', ['--version']).catch(
      function () {
        return { code: 1, stderr: '', stdout: '' };
      },
    );
    if (prerequisite.code == 0 || dontSkip) {
      const project = await createProjectFromWorkspace('sbt-app');

      const { code } = await runSnykCLI('test -d', {
        cwd: project.path(),
        env,
      });

      expect(code).toEqual(0);
    } else {
      console.warn('sbt not found, skipping test!');
    }
  });

  test('run `snyk test` on a pnpm project', async () => {
    const project = await createProjectFromFixture('pnpm-app');

    const { code } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
  });

  test('run `snyk test` on an npm project with lockfile', async () => {
    const project = await createProjectFromFixture('npm-bundled-dep');

    const { code, stdout } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env,
    });

    expect(stdout).toMatch('Target file:       package-lock.json');
    expect(stdout).toMatch('Package manager:   npm');

    expect(code).toEqual(0);
  });

  test('run `snyk test` on a pnpm project without `enablePnpmCli` feature flag enabled', async () => {
    server.setFeatureFlag('enablePnpmCli', false);
    const project = await createProjectFromFixture('pnpm-app');

    const { code, stdout } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env,
    });

    expect(stdout).toMatch('Target file:       package.json');
    expect(stdout).toMatch('Package manager:   npm');

    expect(code).toEqual(0);
  });

  test('run `snyk test` on a pnpm project with `enablePnpmCli` feature flag enabled', async () => {
    server.setFeatureFlag('enablePnpmCli', true);

    const project = await createProjectFromWorkspace('pnpm-app-extended');

    const { code, stdout } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env,
    });

    expect(stdout).toMatch('Target file:       pnpm-lock.yaml');
    expect(stdout).toMatch('Package manager:   pnpm');

    expect(code).toEqual(0);
  });

  test('run `snyk test` on an out of sync pnpm project with --strict-out-of-sync=false', async () => {
    server.setFeatureFlag('enablePnpmCli', true);

    const project = await createProjectFromWorkspace('pnpm-app-out-of-sync');

    const { code, stdout } = await runSnykCLI(
      'test -d --strict-out-of-sync=false',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(stdout).toMatch('Target file:       pnpm-lock.yaml');
    expect(stdout).toMatch('Package manager:   pnpm');

    expect(code).toEqual(0);
  });

  test('run `snyk test` on an out of sync pnpm project without out of sync option', async () => {
    server.setFeatureFlag('enablePnpmCli', true);

    const project = await createProjectFromWorkspace('pnpm-app-out-of-sync');

    const { code } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(2);
  });
});
