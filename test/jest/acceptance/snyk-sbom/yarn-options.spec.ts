import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom --yarn-workspaces (mocked server only)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll(
    () =>
      new Promise((res) => {
        const port = process.env.PORT || process.env.SNYK_PORT || '58589';
        const baseApi = '/api/v1';
        env = {
          ...process.env,
          SNYK_API: 'http://localhost:' + port + baseApi,
          SNYK_HOST: 'http://localhost:' + port,
          SNYK_TOKEN: '123456789',
          SNYK_DISABLE_ANALYTICS: '1',
        };
        server = fakeServer(baseApi, env.SNYK_TOKEN);
        server.listen(port, res);
      }),
  );

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll(
    () =>
      new Promise((res) => {
        server.close(res);
      }),
  );

  test('`sbom yarn-workspaces` generates an SBOM for multiple yarn workspaces', async () => {
    const project = await createProjectFromWorkspace('yarn-workspaces');

    const { code, stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug --yarn-workspaces`,
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
    expect(bom.metadata.component.name).toEqual('yarn-workspaces');
    expect(bom.components).toHaveLength(9);
  });
});
