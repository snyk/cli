import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { isCLIV2 } from '../../util/isCLIV2';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom (mocked server only)', () => {
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

  test('`sbom` generates an SBOM for a single project', async () => {
    const project = await createProjectFromWorkspace('npm-package');

    if (isCLIV2()) {
      const { code, stdout } = await runSnykCLI(
        `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug`,
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
    }
  });
});
