import { runCommand, RunCommandResult } from '../../util/runCommand';
import { runSnykCLI } from '../../util/runSnykCLI';
import { createProject } from '../../util/createProject';
import { getProtectRemovalMessage } from '../../../../src/cli/commands/protect';
import stripAnsi from 'strip-ansi';

jest.setTimeout(1000 * 60);

test('patch is skipped when dependency is newer than one being patched', async () => {
  const project = await createProject('protect-lodash-skip');

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

  const previousLodash = await project.read('node_modules/lodash/lodash.js');

  expect(await runSnykCLI('protect', { cwd: project.path() })).toEqual(
    expect.objectContaining<RunCommandResult>({
      code: 0,
      stdout:
        'Successfully applied Snyk patches' +
        stripAnsi(getProtectRemovalMessage()) +
        '\n',
      stderr: expect.any(String),
    }),
  );

  expect(await project.read('node_modules/lodash/lodash.js')).toEqual(
    previousLodash,
  );
});
