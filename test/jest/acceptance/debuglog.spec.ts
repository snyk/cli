import { runSnykCLI } from '../util/runSnykCLI';
import { createProjectFromWorkspace } from '../util/createProject';

jest.setTimeout(1000 * 60);

describe('debug log', () => {
  it('redacts token from env var', async () => {
    const project = await createProjectFromWorkspace('cocoapods-app');
    const token = 'mytoken';

    const { stderr } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        DEBUG: '*',
        SNYK_LOG_LEVEL: 'trace',
        SNYK_TOKEN: token,
      },
    });

    expect(stderr).not.toContain(token);
  });

  it('redacts token from config file', async () => {
    const project = await createProjectFromWorkspace('cocoapods-app');

    const config = await runSnykCLI('config get api');
    const expectedToken = config.stdout.trim();

    const { stderr } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        DEBUG: '*',
        SNYK_LOG_LEVEL: 'trace',
      },
    });

    expect(expectedToken).not.toBeFalsy();
    expect(stderr).not.toContain(expectedToken);
  });
});
