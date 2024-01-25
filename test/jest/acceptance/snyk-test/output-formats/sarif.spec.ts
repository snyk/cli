import { createProjectFromFixture } from '../../../util/createProject';
import { runSnykCLI } from '../../../util/runSnykCLI';
import { fakeServer } from '../../../../acceptance/fake-server';

jest.setTimeout(1000 * 60);

describe('snyk test --sarif', () => {
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

  test('`snyk test --sarif` includes the expected output', async () => {
    const project = await createProjectFromFixture(
      'npm/with-vulnerable-lodash-dep',
    );
    server.setCustomResponse(
      await project.readJSON('test-dep-graph-result.json'),
    );

    const { code, stdout } = await runSnykCLI('test --sarif', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(1);

    expect(stdout).toContain('"artifactsScanned": 1');
    expect(stdout).toContain('"cvssv3_baseScore": 5.3');
    expect(stdout).toContain('"fullyQualifiedName": "lodash@4.17.15"');
    expect(stdout).toContain('Upgrade to lodash@4.17.17');
  });
});
