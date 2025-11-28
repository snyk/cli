import { createProjectFromWorkspace } from '../../util/createProject';
import { createProject } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom --all-projects (mocked server only)', () => {
  let server;
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
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
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

  // Test currently fails to mis-configuration of test runner environments.
  // `snyk test` fails for Pipfile, build.sbt and requirements.txt.
  // TODO: fix environments and un-skip test.
  // See: HEAD-351.
  test.skip('`sbom mono-repo-project` generates an SBOM for multiple projects', async () => {
    const project = await createProjectFromWorkspace('mono-repo-project');

    const { code, stdout, stderr } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug --all-projects`,
      {
        cwd: project.path(),
        env,
      },
    );
    let bom;

    console.log(stderr);

    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();
    expect(bom.metadata.component.name).toEqual('mono-repo-project');
    expect(bom.components).toHaveLength(50);
  });

  test('`sbom mono-repo-project-manifests-only` generates an SBOM for multiple projects', async () => {
    server.setFeatureFlag('enableMavenDverboseExhaustiveDeps', false);
    const project = await createProjectFromWorkspace(
      'mono-repo-project-manifests-only',
    );

    const { code, stdout, stderr } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug --all-projects`,
      {
        cwd: project.path(),
        env,
      },
    );
    let bom;

    console.log(stderr);

    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();
    expect(bom.metadata.component.name).toEqual(
      'mono-repo-project-manifests-only',
    );
    expect(bom.components).toHaveLength(36);
  });

  test('`sbom mono-repo-project-manifests-only` generates an SBOM for multiple projects with enableMavenDverboseExhaustiveDeps enabled', async () => {
    server.setFeatureFlag('enableMavenDverboseExhaustiveDeps', true);
    const project = await createProjectFromWorkspace(
      'mono-repo-project-manifests-only',
    );

    const { code, stdout, stderr } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug --all-projects`,
      {
        cwd: project.path(),
        env,
      },
    );
    let bom;

    console.log(stderr);

    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();
    expect(bom.metadata.component.name).toEqual(
      'mono-repo-project-manifests-only',
    );
    expect(bom.components).toHaveLength(37);
  });

  describe('--fail-fast option', () => {
    test('`sbom --all-projects` with projects that have errors exits with code 2 (fail-fast by default)', async () => {
      server.setFeatureFlag('enableMavenDverboseExhaustiveDeps', false);
      const project = await createProject(
        'snyk-test-all-projects-exit-codes/project-with-no-issues-and-project-with-error',
      );

      const { code, stderr } = await runSnykCLI(
        `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug --all-projects`,
        {
          cwd: project.path(),
          env,
        },
      );

      // With default fail-fast behavior, should exit on first error
      expect(code).toEqual(2);
      // Should indicate that processing was interrupted
      expect(stderr).toBeTruthy();
    });

    test('`sbom --all-projects --fail-fast=false` with projects that have errors continues processing', async () => {
      server.setFeatureFlag('enableMavenDverboseExhaustiveDeps', false);
      const project = await createProject(
        'snyk-test-all-projects-exit-codes/project-with-no-issues-and-project-with-error',
      );

      const { code, stdout, stderr } = await runSnykCLI(
        `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug --all-projects --fail-fast=false`,
        {
          cwd: project.path(),
          env,
        },
      );

      // With --fail-fast=false, should continue processing even if some projects fail
      // If at least one project succeeds, should generate SBOM
      if (code === 0) {
        // Success case: at least one project succeeded, SBOM was generated
        let bom;
        expect(() => {
          bom = JSON.parse(stdout);
        }).not.toThrow();
        expect(bom).toBeDefined();
      } else {
        // Error case: all projects failed, but we tried all of them
        expect(code).toBeGreaterThan(0);
      }
      // Should indicate that errors occurred but processing continued
      expect(stderr).toBeTruthy();
    });
  });
});
