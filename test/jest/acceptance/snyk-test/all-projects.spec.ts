import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(1000 * 60);

describe('snyk test --all-projects (mocked server only)', () => {
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
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
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

  test('`test yarn-out-of-sync` out of sync fails by default', async () => {
    const project = await createProjectFromWorkspace(
      'yarn-workspace-out-of-sync',
    );

    const { code, stdout, stderr } = await runSnykCLI('test --all-projects', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(2);

    expect(stdout).toMatch(
      'Failed to get dependencies for all 3 potential projects.\nTip: Re-run in debug mode to see more information: DEBUG=*snyk* <COMMAND>\nIf the issue persists contact support@snyk.io',
    );
    expect(stderr).toEqual('');
  });

  test('`test yarn-out-of-sync` --strict-out-of-sync=false scans all the workspace projects', async () => {
    const project = await createProjectFromWorkspace(
      'yarn-workspace-out-of-sync',
    );

    const { code, stdout, stderr } = await runSnykCLI(
      'test --all-projects --strict-out-of-sync=false',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(stdout).toMatch('Tested 3 projects, no vulnerable paths were found');

    // detected only the workspace root
    expect(stdout).toMatch('Package manager:   yarn');
    expect(stdout).toMatch('Project name:      package.json');
    // workspaces themselves detected too
    expect(stderr).toMatch('');
    // detected only the workspace root
    expect(stdout).toMatch('Project name:      tomatoes');
    expect(stdout).toMatch('Project name:      apples');
  });

  test('`test ruby-app --all-projects`', async () => {
    const project = await createProjectFromWorkspace('ruby-app');

    server.setDepGraphResponse(
      await project.readJSON('test-graph-result.json'),
    );

    const { code, stdout, stderr } = await runSnykCLI('test --all-projects', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(1);

    expect(stdout).toMatch('Package manager:   rubygems');
    expect(stdout).toMatch('Target file:       Gemfile.lock');
    expect(stderr).toEqual('');
  });

  test('`test ruby-app-thresholds --all-projects --ignore-policy`', async () => {
    const project = await createProjectFromWorkspace('ruby-app-thresholds');
    server.setDepGraphResponse(
      await project.readJSON('test-graph-result-medium-severity.json'),
    );
    const { code, stdout, stderr } = await runSnykCLI(
      'test --all-projects --ignore-policy',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(1);
    const req = server.popRequest();
    expect(req.query.ignorePolicy).toBeTruthy(); // should request to ignore the policy

    expect(stdout).toMatch(
      'Tested 7 dependencies for known vulnerabilities, found 5 vulnerabilities, 6 vulnerable paths.',
    );
    expect(stderr).toEqual('');
  });

  test('`test mono-repo-with-ignores --all-projects` respects .snyk policy', async () => {
    const project = await createProjectFromWorkspace('mono-repo-with-ignores');

    const { code, stdout, stderr } = await runSnykCLI(
      'test --all-projects --detection-depth=3',
      {
        cwd: project.path(),
        env,
      },
    );
    const backendRequests = server.popRequests(2);
    expect(backendRequests).toHaveLength(2);
    expect(backendRequests[0].method).toEqual('POST');
    expect(backendRequests[0].headers['x-snyk-cli-version']).toBeDefined();
    expect(backendRequests[0].url).toMatch('/api/v1/test-dep-graph');
    expect(backendRequests[0].body.depGraph).not.toBeNull();
    const vulnerableFolderPath =
      process.platform === 'win32'
        ? 'vulnerable\\package-lock.json'
        : 'vulnerable/package-lock.json';

    expect(backendRequests[1].method).toEqual('POST');
    expect(backendRequests[1].headers['x-snyk-cli-version']).toBeDefined();
    expect(backendRequests[1].url).toMatch('/api/v1/test-dep-graph');
    expect(backendRequests[1].body.depGraph).not.toBeNull();
    expect(backendRequests[1].body.depGraph.pkgManager.name).toBe('npm');
    // local policy found and sent to backend
    expect(backendRequests[1].body.policy).toMatch('npm:node-uuid:20160328');
    expect(
      backendRequests[1].body.targetFileRelativePath.endsWith(
        vulnerableFolderPath,
      ),
    ).toBeTruthy();

    expect(code).toEqual(0);

    expect(stdout).toMatch('Package manager:   npm');
    expect(stdout).toMatch('Target file:       package-lock.json');
    expect(stderr).toEqual('');
  });

  test('`test empty --all-projects`', async () => {
    const project = await createProjectFromWorkspace('empty');

    const { code, stdout, stderr } = await runSnykCLI('test --all-projects', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(3);

    expect(stdout).toMatch('Could not detect supported target files');
    expect(stderr).toEqual('');
  });

  test('`test composer-app --all-projects`', async () => {
    const project = await createProjectFromWorkspace('composer-app');

    const { code, stdout, stderr } = await runSnykCLI('test --all-projects', {
      cwd: project.path(),
      env,
    });

    const backendRequests = server.popRequests(1);
    expect(backendRequests).toHaveLength(1);

    backendRequests.forEach((req) => {
      expect(req.method).toEqual('POST');
      expect(req.headers['x-snyk-cli-version']).not.toBeUndefined();
      expect(req.url).toMatch('/api/v1/test');
    });

    expect(code).toEqual(0);

    expect(stdout).toMatch('Target file:       composer.lock');
    expect(stdout).toMatch('Package manager:   composer');
    expect(stderr).toEqual('');
  });
});
