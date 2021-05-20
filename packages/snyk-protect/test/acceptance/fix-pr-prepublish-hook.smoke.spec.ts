import { createProject } from '../util/createProject';
import { getPatchedLodash } from '../util/getPatchedLodash';
import { runCommand } from '../util/runCommand';

jest.setTimeout(1000 * 60);

describe('Fix PR "prepublish" hook', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('patches vulnerable dependencies on install', async () => {
    const project = await createProject('fix-pr-prepublish-hook');
    const patchedLodash = await getPatchedLodash();

    const { code, stdout, stderr } = await runCommand('npm', ['install'], {
      cwd: project.path(),
    });

    expect(stderr).toEqual('');
    expect(stdout).toMatch('patched');
    expect(code).toEqual(0);
    await expect(
      project.read('node_modules/lodash/lodash.js'),
    ).resolves.toEqual(patchedLodash);
  });
});
