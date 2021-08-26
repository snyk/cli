import { createProject } from '../../util/createProject';
import { requireSnykToken } from '../../util/requireSnykToken';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('packages with no name', () => {
  const env = {
    ...process.env,
    SNYK_TOKEN: requireSnykToken(),
    SNYK_DISABLE_ANALYTICS: '1',
  };

  test('packages with no name read dir', async () => {
    const project = await createProject('package-sans-name');
    const { code } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(1);
  });

  test('packages with no name read dir with a lockfile', async () => {
    const project = await createProject('package-sans-name-lockfile');
    const { code } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(1);
  });
});
