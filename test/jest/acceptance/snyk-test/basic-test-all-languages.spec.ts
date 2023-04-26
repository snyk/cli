import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { runCommand } from '../../util/runCommand';
import { isDontSkipTestsEnabled } from '../../util/isDontSkipTestsEnabled';

jest.setTimeout(1000 * 60);

describe('`snyk test` of basic projects for each language/ecosystem', () => {
  let server;
  let env: Record<string, string>;
  let dontSkip: boolean;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
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

  test('run `snyk test` on a python project', async () => {
    const project = await createProjectFromWorkspace('pip-app');
    let pythonCommand = 'python';

    await runCommand(pythonCommand, ['--version']).catch(function() {
      pythonCommand = 'python3';
    });

    console.debug('Using: ' + pythonCommand);

    const pipResult = await runCommand(
      pythonCommand,
      ['-m', 'pip', 'install', '-r', 'requirements.txt'],
      {
        shell: true,
        cwd: project.path(),
      },
    );
    expect(pipResult.code).toEqual(0);

    const { code } = await runSnykCLI('test -d --command=' + pythonCommand, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
  });

  test('run `snyk test` on a gradle project', async () => {
    const project = await createProjectFromWorkspace('gradle-app');

    const { code } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
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
      env,
    });

    expect(code).toEqual(0);
  });

  test('run `snyk test` on a hex project', async () => {
    const prerequisite = await runCommand('mix', ['--version']).catch(
      function() {
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
      function() {
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
      function() {
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
});
