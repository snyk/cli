import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { runCommand } from '../../util/runCommand';

jest.setTimeout(1000 * 60);

describe('snyk test for go projects', () => {
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

  test('run `snyk test` on a go project and ensure that required modules are not cached', async () => {
    const project = await createProjectFromWorkspace('golang-gomodules');

    // clean cache
    const cleanupResult = await runCommand('go', ['clean', '-modcache'], {
      shell: true,
    });

    if (cleanupResult.code == 0) {
      console.log('go cache cleaned ' + cleanupResult.code);
    } else {
      console.warn("Please ensure to install 'go' to run this test.");
    }

    const { code } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(0);
  });
});
