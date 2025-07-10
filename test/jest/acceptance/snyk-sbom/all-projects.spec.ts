import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom --all-projects (mocked server only)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '58585';
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
});
