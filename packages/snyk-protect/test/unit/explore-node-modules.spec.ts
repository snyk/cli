import * as path from 'path';
import { checkProject } from '../../src/lib/explore-node-modules';
import { PhysicalModuleToPatch } from '../../src/lib/types';

describe(checkProject.name, () => {
  it('works with no matching physical modules', () => {
    const fixtureFolderRelativePath = '../fixtures/no-matching-paths';
    const fixtureFolder = path.join(__dirname, fixtureFolderRelativePath);

    const physicalModulesToPatch: PhysicalModuleToPatch[] = []; // this will get populated by checkProject
    checkProject(fixtureFolder, ['lodash'], physicalModulesToPatch);

    expect(physicalModulesToPatch).toHaveLength(0);
  });

  it('works with single matching physical module', () => {
    const fixtureFolderRelativePath = '../fixtures/single-patchable-module';
    const fixtureFolder = path.join(__dirname, fixtureFolderRelativePath);

    const physicalModulesToPatch: PhysicalModuleToPatch[] = []; // this will get populated by checkProject
    checkProject(fixtureFolder, ['lodash'], physicalModulesToPatch);

    expect(physicalModulesToPatch).toHaveLength(1);
    const m = physicalModulesToPatch[0];
    expect(m.name).toBe('lodash');
    expect(m.version).toBe('4.17.15');
    expect(m.folderPath).toEqual(
      path.join(
        __dirname,
        fixtureFolderRelativePath,
        '/node_modules/nyc/node_modules/lodash',
      ),
    );
  });

  it('works with multiple matching physical modules', () => {
    const fixtureFolderRelativePath = '../fixtures/multiple-matching-paths';
    const fixtureFolder = path.join(__dirname, fixtureFolderRelativePath);

    const physicalModulesToPatch: PhysicalModuleToPatch[] = []; // this will get populated by checkProject
    checkProject(fixtureFolder, ['lodash'], physicalModulesToPatch);

    expect(physicalModulesToPatch).toHaveLength(2);
    const m0 = physicalModulesToPatch[0];
    expect(m0.name).toBe('lodash');
    expect(m0.version).toBe('4.17.15');
    expect(m0.folderPath).toEqual(
      path.join(__dirname, fixtureFolderRelativePath, '/node_modules/lodash'),
    );
    const m1 = physicalModulesToPatch[1];
    expect(m1.name).toBe('lodash');
    expect(m1.version).toBe('4.17.15');
    expect(m1.folderPath).toEqual(
      path.join(
        __dirname,
        fixtureFolderRelativePath,
        '/node_modules/nyc/node_modules/lodash',
      ),
    );
  });
});
