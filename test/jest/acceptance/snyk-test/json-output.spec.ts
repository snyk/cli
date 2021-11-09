import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('snyk test --json', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = process.env.PORT || process.env.SNYK_PORT || '12345';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + apiPort + apiPath,
      SNYK_TOKEN: '123456789', // replace token from process.env
      SNYK_DISABLE_ANALYTICS: '1',
    };

    server = fakeServer(apiPath, env.SNYK_TOKEN);
    server.listen(apiPort, () => done());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('includes path errors', async () => {
    const project = await createProjectFromWorkspace(
      'no-supported-target-files',
    );
    const { code, stdout } = await runSnykCLI(`test --json`, {
      cwd: project.path(),
      env: env,
    });

    expect(code).toEqual(3);
    expect(JSON.parse(stdout)).toMatchObject({
      path: project.path(),
      error: expect.stringContaining(
        `Could not detect supported target files in ${project.path()}.`,
      ),
    });
  });
});
