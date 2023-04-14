import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('snyk client-sbom --all-projects', () => {
  let env: Record<string, string>;

  beforeAll(() => {
    env = {
      ...process.env,
      SNYK_DISABLE_ANALYTICS: '1',
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('`client-sbom yarn-out-of-sync` skips the out of sync project and scans the rest', async () => {
    const project = await createProjectFromWorkspace(
      'yarn-workspace-out-of-sync',
    );

    const { code, stdout, stderr } = await runSnykCLI('client-sbom --all-projects', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);

    expect(stdout).toMatch(
      'packages/apples/package.json: Found 4 yarn dependencies',
    );
    expect(stdout).toMatch(
      'packages/tomatoes/package.json: Found 3 yarn dependencies',
    );

    expect(stderr).toMatch(
      '✗ 1/3 potential projects failed to get dependencies',
    );
    expect(stderr).toMatch(
      `Dependency snyk was not found in yarn.lock. Your package.json and yarn.lock are probably out of sync. Please run "yarn install" and try again.`,
    );
  });

  test('`client-sbom yarn-out-of-sync` with --fail-fast errors the whole scan', async () => {
    const project = await createProjectFromWorkspace(
      'yarn-workspace-out-of-sync',
    );

    const { code, stdout, stderr } = await runSnykCLI(
      'client-sbom --all-projects --fail-fast',
      {
        cwd: project.path(),
        env,
      },
    );
    expect(code).toEqual(2);

    expect(stdout).toMatch(
      'Your client-sbom request could not be completed.\nTip: Re-run in debug mode to see more information: DEBUG=*snyk* <COMMAND>\nIf the issue persists contact support@snyk.io',
    );
    expect(stderr).toMatch(
      '✗ 1/3 potential projects failed to get dependencies',
    );
    expect(stderr).toMatch(
      `Dependency snyk was not found in yarn.lock. Your package.json and yarn.lock are probably out of sync. Please run "yarn install" and try again.`,
    );
  });

  test('`client-sbom yarn-out-of-sync` --strict-out-of-sync=false scans all the workspace projects', async () => {
    const project = await createProjectFromWorkspace(
      'yarn-workspace-out-of-sync',
    );

    const { code, stdout, stderr } = await runSnykCLI(
      'client-sbom --all-projects --strict-out-of-sync=false',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(stdout).toMatch('package.json: Found 3 yarn dependencies');
    expect(stdout).toMatch(
      'packages/apples/package.json: Found 4 yarn dependencies',
    );
    expect(stdout).toMatch(
      'packages/tomatoes/package.json: Found 3 yarn dependencies',
    );
    expect(stderr).toEqual('');
  });

  test('`client-sbom ruby-app --all-projects`', async () => {
    const project = await createProjectFromWorkspace('ruby-app');

    const { code, stdout, stderr } = await runSnykCLI('client-sbom --all-projects', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    expect(stdout).toMatch('Gemfile.lock: Found 3 rubygems dependencies');
    expect(stderr).toEqual('');
  });

  test('`deps empty --all-projects`', async () => {
    const project = await createProjectFromWorkspace('empty');

    const { code, stdout, stderr } = await runSnykCLI('deps --all-projects', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(3);

    expect(stdout).toMatch('Could not detect supported target files');
    expect(stderr).toEqual('');
  });

  test('`deps composer-app --all-projects`', async () => {
    const project = await createProjectFromWorkspace('composer-app');

    const { code, stdout, stderr } = await runSnykCLI('deps --all-projects', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);

    expect(stdout).toMatch('composer.lock: Found 30 composer dependencies');
    expect(stderr).toEqual('');
  });
});
