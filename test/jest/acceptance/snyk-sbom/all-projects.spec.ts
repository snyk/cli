import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { isCLIV2 } from '../../util/isCLIV2';

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

  test('`sbom mono-repo-project` generates an SBOM for multiple projects', async () => {
    const project = await createProjectFromWorkspace('mono-repo-project');

    if (isCLIV2()) {
      const { code, stdout } = await runSnykCLI(
        `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug --all-projects`,
        {
          cwd: project.path(),
          env,
        },
      );

      expect(code).toEqual(0);
      expect(stdout).toEqual(
        expect.stringContaining(
          '{"bomFormat":"CycloneDX","metadata":{"component":{"name":"mono-repo-project"}}}',
        ),
      );
    }
  });
});
