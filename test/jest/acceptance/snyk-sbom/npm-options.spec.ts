import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom: npm options (mocked server only)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '58584';
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

  test('`sbom --strict-out-of-sync=false` generates an SBOM for the NPM project by NOT preventing scanning out-of-sync NPM lockfiles.', async () => {
    const project = await createProjectFromWorkspace('npm-out-of-sync');

    const { code, stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --strict-out-of-sync=false --debug`,
      {
        cwd: project.path(),
        env,
      },
    );
    let bom;

    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();
    expect(bom.metadata.component.name).toEqual('npm-package');
    expect(bom.components).toHaveLength(3);
  });

  test('`sbom --strict-out-of-sync=true` fails to generate an SBOM for the NPM project because out-of-sync NPM lockfiles.', async () => {
    const project = await createProjectFromWorkspace('npm-out-of-sync');

    const { code, stdout, stderr } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --strict-out-of-sync=true --debug`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(2);
    expect(stdout).toContain(
      'An error occurred while running the underlying analysis needed to generate the SBOM.',
    );
    expect(stderr).toContain(
      'OutOfSyncError: Dependency snyk was not found in package-lock.json.',
    );
  });
});
