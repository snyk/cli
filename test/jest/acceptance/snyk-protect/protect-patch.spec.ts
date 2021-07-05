import { runCommand, RunCommandResult } from '../../util/runCommand';
import { runSnykCLI } from '../../util/runSnykCLI';
import { createProject } from '../../util/createProject';

jest.setTimeout(1000 * 60);

test('patch is applied to vulnerable dependency', async () => {
  const project = await createProject('protect-semver');

  expect(
    await runCommand('npm', ['install'], {
      cwd: project.path(),
    }),
  ).toEqual(
    expect.objectContaining<RunCommandResult>({
      code: 0,
      stdout: expect.any(String),
      stderr: expect.any(String),
    }),
  );

  const previousSemver = await project.read('node_modules/semver/semver.js');

  expect(await runSnykCLI('protect', { cwd: project.path() })).toEqual(
    expect.objectContaining<RunCommandResult>({
      code: 0,
      stdout: 'Successfully applied Snyk patches',
      stderr: expect.any(String),
    }),
  );

  expect(await project.read('node_modules/semver/semver.js')).not.toEqual(
    previousSemver,
  );
});
