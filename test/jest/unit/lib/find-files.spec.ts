import * as fs from 'fs';
import * as os from 'os';
import * as pathLib from 'path';

import { find } from '../../../../src/lib/find-files';

describe('find() ignored folders', () => {
  let workspace: string;

  // A `.git` directory can't be committed as a fixture (git tracks a nested
  // `.git` as a gitlink), so the tree is built on disk for these tests.
  beforeAll(() => {
    workspace = fs.mkdtempSync(pathLib.join(os.tmpdir(), 'find-files-'));

    fs.writeFileSync(pathLib.join(workspace, 'package.json'), '{}');

    for (const folder of ['.git', 'node_modules', '.build']) {
      fs.mkdirSync(pathLib.join(workspace, folder));
      fs.writeFileSync(pathLib.join(workspace, folder, 'package.json'), '{}');
    }

    // Mirrors the loose-object fan-out that made a real repo's `.git` the most
    // expensive and most race-prone subtree to walk. See CLI-1737.
    fs.mkdirSync(pathLib.join(workspace, '.git', 'objects', 'ab'), {
      recursive: true,
    });
    fs.writeFileSync(
      pathLib.join(workspace, '.git', 'objects', 'ab', 'cdef'),
      '',
    );

    // A directory whose name merely *ends* in an ignored folder name must still
    // be scanned.
    fs.mkdirSync(pathLib.join(workspace, 'my_node_modules'));
    fs.writeFileSync(
      pathLib.join(workspace, 'my_node_modules', 'package.json'),
      '{}',
    );
  });

  afterAll(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('does not traverse ignored folders', async () => {
    const { allFilesFound } = await find({ path: workspace, levelsDeep: 6 });

    expect(allFilesFound).toContain(pathLib.join(workspace, 'package.json'));
    expect(
      allFilesFound.filter((file) =>
        ['.git', 'node_modules', '.build'].some((folder) =>
          file.split(pathLib.sep).includes(folder),
        ),
      ),
    ).toEqual([]);
  });

  it.each(['.git', 'node_modules', '.build'])(
    'returns nothing when the scan root itself is %s',
    async (folder) => {
      const { files, allFilesFound } = await find({
        path: pathLib.join(workspace, folder),
        levelsDeep: 6,
      });

      expect(files).toEqual([]);
      expect(allFilesFound).toEqual([]);
    },
  );

  it('returns nothing when the scan root is an ignored folder with a trailing separator', async () => {
    const { allFilesFound } = await find({
      path: pathLib.join(workspace, '.build') + pathLib.sep,
      levelsDeep: 6,
    });

    expect(allFilesFound).toEqual([]);
  });

  it('scans a directory whose name only ends in an ignored folder name', async () => {
    const expected = pathLib.join(workspace, 'my_node_modules', 'package.json');

    const asScanRoot = await find({
      path: pathLib.join(workspace, 'my_node_modules'),
      levelsDeep: 6,
    });
    expect(asScanRoot.files).toEqual([expected]);

    const asSubdirectory = await find({ path: workspace, levelsDeep: 6 });
    expect(asSubdirectory.allFilesFound).toContain(expected);
  });
});
