import * as fs from 'fs';
import * as pathLib from 'path';
import { extractProvenance } from '../../../../../../src/plugins/python/handlers/pip-requirements/extract-version-provenance';
import { parseRequirementsFile } from '../../../../../../src/plugins/python/handlers/pip-requirements/update-dependencies/requirements-file-parser';

describe('extractProvenance', () => {
  const workspacesPath = pathLib.resolve(__dirname, 'workspaces');
  it('can extract and parse 1 required files', async () => {
    // Arrange
    const targetFile = pathLib.resolve(workspacesPath, 'with-require/dev.txt');

    const workspace = {
      readFile: async (path: string) => {
        return fs.readFileSync(pathLib.resolve(workspacesPath, path), 'utf-8');
      },
      writeFile: async () => {
        return;
      },
    };
    const { dir, base } = pathLib.parse(targetFile);

    // Act
    const result = await extractProvenance(workspace, dir, base);
    // Assert
    const baseTxt = fs.readFileSync(
      pathLib.resolve(workspacesPath, 'with-require/base.txt'),
      'utf-8',
    );
    const devTxt = fs.readFileSync(targetFile, 'utf-8');

    expect(result['dev.txt']).toEqual(parseRequirementsFile(devTxt));
    expect(result['base.txt']).toEqual(parseRequirementsFile(baseTxt));
  });

  it('can extract and parse 1 required files', async () => {
    // Arrange
    const targetFile = pathLib.resolve(
      workspacesPath,
      'with-require-folder-up/reqs/requirements.txt',
    );

    const workspace = {
      readFile: async (path: string) => {
        return fs.readFileSync(pathLib.resolve(workspacesPath, path), 'utf-8');
      },
      writeFile: async () => {
        return;
      },
    };
    const { dir, base } = pathLib.parse(targetFile);

    // Act
    const result = await extractProvenance(workspace, dir, base);
    // Assert
    const baseTxt = fs.readFileSync(
      pathLib.resolve(workspacesPath, 'with-require-folder-up/base.txt'),
      'utf-8',
    );
    const requirementsTxt = fs.readFileSync(targetFile, 'utf-8');

    expect(result['requirements.txt']).toEqual(
      parseRequirementsFile(requirementsTxt),
    );
    expect(result['../base.txt']).toEqual(parseRequirementsFile(baseTxt));
  });
  it('can extract and parse all required files with both -r and -c', async () => {
    // Arrange
    const folder = 'with-multiple-requires';
    const targetFile = pathLib.resolve(workspacesPath, `${folder}/dev.txt`);

    const workspace = {
      readFile: async (path: string) => {
        return fs.readFileSync(pathLib.resolve(workspacesPath, path), 'utf-8');
      },
      writeFile: async () => {
        return;
      },
    };
    const { dir, base } = pathLib.parse(targetFile);

    // Act
    const result = await extractProvenance(workspace, dir, base);
    // Assert
    const baseTxt = fs.readFileSync(
      pathLib.resolve(workspacesPath, pathLib.join(folder, 'base.txt')),
      'utf-8',
    );
    const reqsBaseTxt = fs.readFileSync(
      pathLib.resolve(workspacesPath, pathLib.join(folder, 'reqs', 'base.txt')),
      'utf-8',
    );
    const devTxt = fs.readFileSync(targetFile, 'utf-8');
    const constraintsTxt = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        pathLib.join(folder, 'reqs', 'constraints.txt'),
      ),
      'utf-8',
    );

    expect(result['dev.txt']).toEqual(parseRequirementsFile(devTxt));
    expect(result['base.txt']).toEqual(parseRequirementsFile(baseTxt));
    expect(result['reqs/base.txt']).toEqual(parseRequirementsFile(reqsBaseTxt));
    expect(result['reqs/constraints.txt']).toEqual(
      parseRequirementsFile(constraintsTxt),
    );
  });

  it('can extract and parse all required files when -r is recursive', async () => {
    // Arrange
    const folder = 'with-recursive-requires';
    const targetFile = pathLib.resolve(workspacesPath, `${folder}/dev.txt`);

    const workspace = {
      readFile: async (path: string) => {
        return fs.readFileSync(pathLib.resolve(workspacesPath, path), 'utf-8');
      },
      writeFile: async () => {
        return;
      },
    };
    const { dir, base } = pathLib.parse(targetFile);

    // Act
    const result = await extractProvenance(workspace, dir, base);
    // Assert
    const baseTxt = fs.readFileSync(
      pathLib.resolve(workspacesPath, `${folder}/base.txt`),
      'utf-8',
    );
    const devTxt = fs.readFileSync(targetFile, 'utf-8');
    const constraintsTxt = fs.readFileSync(
      pathLib.resolve(workspacesPath, `${folder}/constraints.txt`),
      'utf-8',
    );

    expect(result['dev.txt']).toEqual(parseRequirementsFile(devTxt));
    expect(result['base.txt']).toEqual(parseRequirementsFile(baseTxt));
    expect(result['constraints.txt']).toEqual(
      parseRequirementsFile(constraintsTxt),
    );
  });
});
