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

const symlinksSupported = ((): boolean => {
  const probe = fs.mkdtempSync(pathLib.join(os.tmpdir(), 'find-files-probe-'));
  try {
    fs.writeFileSync(pathLib.join(probe, 'target'), '');
    fs.symlinkSync(
      pathLib.join(probe, 'target'),
      pathLib.join(probe, 'link'),
      'file',
    );
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(probe, { recursive: true, force: true });
  }
})();

const describeWithSymlinks = symlinksSupported ? describe : describe.skip;

describeWithSymlinks('find() symbolic links', () => {
  let workspace: string;
  let scanRoot: string;
  let outside: string;
  const realManifest = () => pathLib.join(scanRoot, 'real', 'package.json');

  const link = (target: string, linkPath: string, type: 'file' | 'dir') =>
    fs.symlinkSync(target, linkPath, type === 'dir' ? 'junction' : 'file');

  beforeEach(() => {
    workspace = fs.realpathSync(
      fs.mkdtempSync(pathLib.join(os.tmpdir(), 'find-files-symlinks-')),
    );
    scanRoot = pathLib.join(workspace, 'scan');
    outside = pathLib.join(workspace, 'outside');

    fs.mkdirSync(pathLib.join(scanRoot, 'real'), { recursive: true });
    fs.writeFileSync(realManifest(), '{}');

    fs.mkdirSync(pathLib.join(outside, 'project'), { recursive: true });
    fs.writeFileSync(pathLib.join(outside, 'project', 'package.json'), '{}');
    fs.writeFileSync(pathLib.join(outside, 'secret-package.json'), '{}');
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('does not report a manifest file that is a symbolic link', async () => {
    fs.mkdirSync(pathLib.join(scanRoot, 'linked-file'));
    link(
      pathLib.join(outside, 'secret-package.json'),
      pathLib.join(scanRoot, 'linked-file', 'package.json'),
      'file',
    );

    const { files, allFilesFound } = await find({
      path: scanRoot,
      levelsDeep: 6,
    });

    expect(files).toEqual([realManifest()]);
    expect(allFilesFound).toEqual([realManifest()]);
  });

  it('does not descend into a symbolic link to a directory outside the scan root', async () => {
    link(
      pathLib.join(outside, 'project'),
      pathLib.join(scanRoot, 'linked-dir'),
      'dir',
    );

    const { files, allFilesFound } = await find({
      path: scanRoot,
      levelsDeep: 6,
    });

    expect(files).toEqual([realManifest()]);
    expect(allFilesFound).toEqual([realManifest()]);
  });

  it('does not descend into a symbolic link to a directory inside the scan root', async () => {
    link(
      pathLib.join(scanRoot, 'real'),
      pathLib.join(scanRoot, 'alias-of-real'),
      'dir',
    );

    const { allFilesFound } = await find({ path: scanRoot, levelsDeep: 6 });

    expect(allFilesFound).toEqual([realManifest()]);
  });

  it('terminates on a symbolic link loop and reports each file once', async () => {
    link(scanRoot, pathLib.join(scanRoot, 'real', 'loop'), 'dir');

    const { files, allFilesFound } = await find({
      path: scanRoot,
      levelsDeep: 10,
    });

    expect(files).toEqual([realManifest()]);
    expect(allFilesFound).toEqual([realManifest()]);
  });

  it('skips a dangling symbolic link', async () => {
    link(
      pathLib.join(workspace, 'does-not-exist'),
      pathLib.join(scanRoot, 'dangling'),
      'file',
    );

    const { allFilesFound } = await find({ path: scanRoot, levelsDeep: 6 });

    expect(allFilesFound).toEqual([realManifest()]);
  });

  it('rejects a scan root that is a symbolic link', async () => {
    const linkedRoot = pathLib.join(workspace, 'linked-root');
    link(scanRoot, linkedRoot, 'dir');

    await expect(find({ path: linkedRoot, levelsDeep: 6 })).rejects.toThrow(
      `${linkedRoot} is a symbolic link. Snyk does not follow symbolic links; pass the real path instead.`,
    );
  });

  it('rejects a scan root that is a symbolic link written with a trailing separator', async () => {
    const linkedRoot = pathLib.join(workspace, 'linked-root');
    link(scanRoot, linkedRoot, 'dir');

    await expect(
      find({ path: linkedRoot + pathLib.sep, levelsDeep: 6 }),
    ).rejects.toThrow('is a symbolic link');
  });

  it('rejects a scan root that is a symbolic link to a file', async () => {
    const linkedFile = pathLib.join(workspace, 'linked-package.json');
    link(pathLib.join(outside, 'secret-package.json'), linkedFile, 'file');

    await expect(
      find({ path: linkedFile, filter: ['linked-package.json'] }),
    ).rejects.toThrow(`${linkedFile} is a symbolic link`);
  });

  it('allows a scan root that is reached through a symbolic link to a parent directory', async () => {
    const linkedParent = pathLib.join(workspace, 'linked-parent');
    link(workspace, linkedParent, 'dir');

    const { files } = await find({
      path: pathLib.join(linkedParent, 'scan'),
      levelsDeep: 6,
    });

    expect(files).toEqual([
      pathLib.join(linkedParent, 'scan', 'real', 'package.json'),
    ]);
  });
});
