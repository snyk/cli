import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 30);

describe('analytics module', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_INTEGRATION_NAME: 'JENKINS',
      SNYK_INTEGRATION_VERSION: '1.2.3',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  it('detects upgradable protect paths with `snyk test` with upgradable path in the cwd', async () => {
    const project = await createProjectFromFixture(
      'protect-update-notification/with-package-json-with-snyk-dep',
    );

    const { code, stdout } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });

    expect(code).toBe(0);
    expect(stdout).toContain(
      'WARNING: It looks like you have the `snyk` dependency in the `package.json` file(s) at the following path(s):',
    );
    expect(stdout).toContain(project.path('package.json'));

    const lastRequest = server.popRequest();
    expect(lastRequest).toMatchObject({
      query: {},
      body: {
        data: {
          command: 'test',
          metadata: {
            'upgradable-snyk-protect-paths': 1,
          },
        },
      },
    });
  });

  it('detects upgradable protect paths with `snyk test` using `--file=`', async () => {
    const project = await createProjectFromFixture(
      'protect-update-notification/with-package-json-with-snyk-dep',
    );

    const pathToFile = project.path('package-lock.json');
    const { code, stdout } = await runSnykCLI(`test --file=${pathToFile}`, {
      // note: not passing in the `cwd` of the project object
      env,
    });

    expect(code).toBe(0);
    expect(stdout).toContain(
      'WARNING: It looks like you have the `snyk` dependency in the `package.json` file(s) at the following path(s):',
    );
    expect(stdout).toContain(project.path('package.json'));

    const lastRequest = server.popRequest();
    expect(lastRequest).toMatchObject({
      query: {},
      body: {
        data: {
          command: 'test',
          metadata: {
            'upgradable-snyk-protect-paths': 1,
          },
        },
      },
    });
  });

  it('detects upgradable protect paths with `snyk test` using paths as positional args', async () => {
    const project = await createProjectFromFixture(
      'protect-update-notification',
    );

    const paths = [
      project.path('with-package-json-with-snyk-dep'),
      project.path('with-package-json-with-snyk-dep-2'),
      project.path('with-package-json-without-snyk-dep'),
    ];

    const pathsStr = paths.join(' ');

    const { code, stdout } = await runSnykCLI(`test ${pathsStr}`, {
      // note: not passing in the `cwd` of the project object
      env,
    });

    expect(code).toBe(0);
    expect(stdout).toContain(
      'WARNING: It looks like you have the `snyk` dependency in the `package.json` file(s) at the following path(s):',
    );
    expect(stdout).toContain(
      project.path('with-package-json-with-snyk-dep/package.json'),
    );
    expect(stdout).toContain(
      project.path('with-package-json-with-snyk-dep-2/package.json'),
    );
    expect(stdout).not.toContain(
      project.path('with-package-json-without-snyk-dep/package.json'),
    );

    const lastRequest = server.popRequest();
    expect(lastRequest).toMatchObject({
      query: {},
      body: {
        data: {
          command: 'test',
          metadata: {
            'upgradable-snyk-protect-paths': 2,
          },
        },
      },
    });
  });

  it('detects no upgradable protect paths with `snyk test` with no upgradable paths in the cwd', async () => {
    const project = await createProjectFromFixture(
      'protect-update-notification/with-package-json-without-snyk-dep',
    );

    const { code, stdout } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });

    expect(code).toBe(0);
    expect(stdout).not.toContain(
      'WARNING: It looks like you have the `snyk` dependency in the `package.json` file(s) at the following path(s):',
    );
    expect(stdout).not.toContain(project.path('package.json'));

    const lastRequest = server.popRequest();
    expect(lastRequest).toMatchObject({
      query: {},
      body: {
        data: {
          command: 'test',
          metadata: {
            'upgradable-snyk-protect-paths': 0,
          },
        },
      },
    });
  });
});
