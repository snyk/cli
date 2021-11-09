import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('snyk policy', () => {
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

  it('loads policy file', async () => {
    const project = await createProjectFromWorkspace('policy');
    const { code, stdout } = await runSnykCLI('policy', {
      cwd: project.path(),
      env: env,
    });

    expect(code).toEqual(0);
    expect(stdout).toMatch('Current Snyk policy, read from .snyk file');
  });

  it('fails when policy not found', async () => {
    const project = await createProjectFromWorkspace('empty');
    const { code, stdout } = await runSnykCLI('policy', {
      cwd: project.path(),
      env: env,
    });

    expect(code).toEqual(2);
    expect(stdout).toMatch('Could not load policy.');
  });
});
