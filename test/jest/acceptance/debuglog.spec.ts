import { runSnykCLI } from '../util/runSnykCLI';
import { createProjectFromWorkspace } from '../util/createProject';

jest.setTimeout(1000 * 60);

describe('debug log', () => {
  it('', async () => {
    const project = await createProjectFromWorkspace('cocoapods-app');
    const token = 'mytoken';

    const { code, stderr } = await runSnykCLI('test -d', {
      cwd: project.path(),
      env: {
        ...process.env,
        SNYK_DISABLE_ANALYTICS: '1',
        DEBUG: '*',
        SNYK_LOG_LEVEL: 'trace',
        SNYK_TOKEN: token,
      },
    });

    console.debug(stderr);
    expect(stderr).not.toContain(token);
    expect(code).toEqual(2);
  });
});
