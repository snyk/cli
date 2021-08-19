import { createProject } from '../util/createProject';
import { getPatchedLodash } from '../util/getPatchedLodash';
import { RunCLIResult, runCommand } from '../util/runCommand';

jest.setTimeout(1000 * 60);

describe('Fix PR', () => {
  test('patches vulnerable dependencies on install', async () => {
    const project = await createProject('fix-pr');
    const patchedLodash = await getPatchedLodash();

    expect(
      await runCommand('npm', ['install'], {
        cwd: project.path(),
      }),
    ).toEqual(
      expect.objectContaining<RunCLIResult>({
        code: 0,
        stdout: expect.stringContaining('Applied Snyk patches.'),
        stderr: expect.any(String),
      }),
    );

    await expect(
      project.read('node_modules/lodash/lodash.js'),
    ).resolves.toEqual(patchedLodash);
  });
});
