import { fakeServer } from '../../acceptance/fake-server';
import { createProject } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

describe('snyk test --all-projects with one project that has errors', () => {
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

  describe('and another that has issues (vulnerabilities)', () => {
    it('should exit with exit code 1 when the `cliFailFast` FF is disabled', async () => {
      const project = await createProject(
        'snyk-test-all-projects-exit-codes/project-with-issues-and-project-with-error',
      );
      const depGraphResStr = await project.read('test-dep-graph-result.json');
      server.depGraphResponse = JSON.parse(depGraphResStr);
      const { code, stderr } = await runSnykCLI(`test --all-projects`, {
        cwd: project.path(),
        env,
      });
      expect(code).toEqual(1);
      expect(stderr).toContain(
        '1/2 potential projects failed to get dependencies.',
      );
      const targetFileWithError = project.path(
        'project-with-error/package.json',
      );
      expect(stderr).toContain(`${targetFileWithError}:`);
      expect(stderr).toContain(
        `Failed to read ${targetFileWithError}. Error: Unexpected token f in JSON at position 3`,
      );
    });

    it('should exit with exit code 1 when the `cliFailFast` FF is enabled but the `--fail-fast` option is not set', async () => {
      const project = await createProject(
        'snyk-test-all-projects-exit-codes/project-with-issues-and-project-with-error',
      );
      const depGraphResStr = await project.read('test-dep-graph-result.json');
      server.depGraphResponse = JSON.parse(depGraphResStr);
      server.setFeatureFlag('cliFailFast', true);
      const { code, stderr } = await runSnykCLI(`test --all-projects`, {
        cwd: project.path(),
        env,
      });
      expect(code).toEqual(1);
      expect(stderr).toContain(
        '1/2 potential projects failed to get dependencies.',
      );
    });

    it('should exit with exit code 2 when the `cliFailFast` FF is enabled and the `--fail-fast` option is set', async () => {
      const project = await createProject(
        'snyk-test-all-projects-exit-codes/project-with-issues-and-project-with-error',
      );
      const depGraphResStr = await project.read('test-dep-graph-result.json');
      server.depGraphResponse = JSON.parse(depGraphResStr);
      server.setFeatureFlag('cliFailFast', true);
      const { code, stderr } = await runSnykCLI(
        `test --all-projects --fail-fast`,
        {
          cwd: project.path(),
          env,
        },
      );
      expect(code).toEqual(2);
      expect(stderr).toContain(
        '1/2 potential projects failed to get dependencies.',
      );
    });
  });

  describe('and another has no issues (vulnerabilities)', () => {
    it('should exit with exit code 0 when the `cliFailFast` FF is disabled', async () => {
      // Note: no need to use fake-server for these test scenarios since the default fake-server response for testing a dep-graph
      // is no issues found which works for our project with no issues.
      const project = await createProject(
        'snyk-test-all-projects-exit-codes/project-with-no-issues-and-project-with-error',
      );

      const { code, stderr } = await runSnykCLI(`test --all-projects`, {
        cwd: project.path(),
        env,
      });
      expect(code).toEqual(0);
      expect(stderr).toContain(
        '1/2 potential projects failed to get dependencies.',
      );
    });

    it('should exit with exit code 0 when the `cliFailFast` FF is enabled but the `--fail-fast` option is not set', async () => {
      const project = await createProject(
        'snyk-test-all-projects-exit-codes/project-with-no-issues-and-project-with-error',
      );
      server.setFeatureFlag('cliFailFast', true);
      const { code, stderr } = await runSnykCLI(`test --all-projects`, {
        cwd: project.path(),
        env,
      });
      expect(code).toEqual(0);
      expect(stderr).toContain(
        '1/2 potential projects failed to get dependencies.',
      );
    });

    it('should exit with exit code 2 when the `cliFailFast` FF is enabled and the `--fail-fast` option is set', async () => {
      const project = await createProject(
        'snyk-test-all-projects-exit-codes/project-with-no-issues-and-project-with-error',
      );
      server.setFeatureFlag('cliFailFast', true);
      const { code, stderr } = await runSnykCLI(
        `test --all-projects --fail-fast`,
        {
          cwd: project.path(),
          env,
        },
      );
      expect(code).toEqual(2);
      expect(stderr).toContain(
        '1/2 potential projects failed to get dependencies.',
      );
    });
  });
});
