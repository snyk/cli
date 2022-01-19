import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { RunCommandResult } from '../../util/runCommand';

jest.setTimeout(1000 * 60);

describe('deduped-package-patch test', () => {
  it('npm deduped packages are found and patched correctly', async () => {
    const project = await createProjectFromFixture('deduped-dep');
    const previousSemver = await project.read('node_modules/semver/semver.js');

    expect(await runSnykCLI('protect', { cwd: project.path() })).toEqual(
      expect.objectContaining<RunCommandResult>({
        code: 0,
        stdout: expect.stringContaining('Successfully applied Snyk patches'),
        stderr: expect.not.stringMatching(/error/gi), // We don't expect an error
      }),
    );

    expect(await project.read('node_modules/semver/semver.js')).not.toEqual(
      previousSemver,
    );
  });
});
