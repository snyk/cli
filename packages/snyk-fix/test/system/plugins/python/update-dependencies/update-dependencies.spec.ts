import * as fs from 'fs';
import * as pathLib from 'path';
import * as snykFix from '../../../../../src';
import {
  generateScanResult,
  generateTestResult,
} from '../../../../helpers/generate-entity-to-fix';

describe('fix *req*.txt / *.txt Python projects', () => {
  let filesToDelete: string[] = [];
  afterEach(() => {
    filesToDelete.map((f) => fs.unlinkSync(f));
  });
  const workspacesPath = pathLib.resolve(__dirname, 'workspaces');
  it('skips projects with a -r option', async () => {
    // Arrange
    const targetFile = 'with-require/dev.txt';

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'django@1.6.1': {
            upgradeTo: 'django@2.0.1',
            vulns: [],
            upgrades: [],
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: [],
            upgrades: [],
          },
        },
      },
    };

    const entityToFix = {
      workspace: {
        readFile: async (path: string) => {
          return fs.readFileSync(
            pathLib.resolve(workspacesPath, path),
            'utf-8',
          );
        },
        writeFile: async (path: string, contents: string) => {
          const res = pathLib.parse(path);
          const fixedPath = pathLib.resolve(
            workspacesPath,
            res.dir,
            `fixed-${res.base}`,
          );
          filesToDelete = [fixedPath];
          fs.writeFileSync(fixedPath, contents, 'utf-8');
        },
      },
      scanResult: generateScanResult('pip', targetFile),
      testResult,
    };

    // Act
    const result = await snykFix.fix([entityToFix]);

    // Assert
    expect(result).toMatchObject({
      exceptionsByScanType: {},
      resultsByPlugin: {
        python: {
          failed: [],
          skipped: [
            {
              original: entityToFix,
              userMessage:
                'Requirements with -r or -c directive are not yet supported',
            },
          ],
          succeeded: [],
        },
      },
    });
  });
  it('does not add extra new lines', async () => {
    // Arrange
    const targetFile = 'basic/prod.txt';
    const fixedFilePath = pathLib.resolve(
      workspacesPath,
      'basic/fixed-prod.txt',
    );

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'django@1.6.1': {
            upgradeTo: 'django@2.0.1',
            vulns: [],
            upgrades: [],
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: [],
            upgrades: [],
          },
        },
      },
    };

    const entityToFix = {
      workspace: {
        readFile: async (path: string) => {
          return fs.readFileSync(
            pathLib.resolve(workspacesPath, path),
            'utf-8',
          );
        },
        writeFile: async (path: string, contents: string) => {
          const res = pathLib.parse(path);
          const fixedPath = pathLib.resolve(
            workspacesPath,
            res.dir,
            `fixed-${res.base}`,
          );
          filesToDelete = [fixedPath];
          fs.writeFileSync(fixedPath, contents, 'utf-8');
        },
      },
      scanResult: generateScanResult('pip', targetFile),
      testResult,
    };

    // Act
    const result = await snykFix.fix([entityToFix]);

    // Assert
    const expectedManifest =
      'Django==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability';
    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptionsByScanType: {},
      resultsByPlugin: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [{ original: entityToFix, userMessage: 'TODO' }],
        },
      },
    });
  });

  it('retains new line eof', async () => {
    // Arrange
    const targetFile = 'basic-with-newline/prod.txt';
    const fixedFilePath = pathLib.resolve(
      workspacesPath,
      'basic-with-newline/fixed-prod.txt',
    );

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'django@1.6.1': {
            upgradeTo: 'django@2.0.1',
            vulns: [],
            upgrades: [],
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: [],
            upgrades: [],
          },
        },
      },
    };

    const entityToFix = {
      workspace: {
        readFile: async (path: string) => {
          return fs.readFileSync(
            pathLib.resolve(workspacesPath, path),
            'utf-8',
          );
        },
        writeFile: async (path: string, contents: string) => {
          const res = pathLib.parse(path);
          const fixedPath = pathLib.resolve(
            workspacesPath,
            res.dir,
            `fixed-${res.base}`,
          );
          filesToDelete = [fixedPath];
          fs.writeFileSync(fixedPath, contents, 'utf-8');
        },
      },
      scanResult: generateScanResult('pip', targetFile),
      testResult,
    };

    // Act
    const result = await snykFix.fix([entityToFix]);

    // Assert
    const expectedManifest =
      'Django==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability\n';
    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptionsByScanType: {},
      resultsByPlugin: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [{ original: entityToFix, userMessage: 'TODO' }],
        },
      },
    });
  });

  it('does not mess formatting', async () => {
    // Arrange
    const targetFile = 'with-custom-formatting/requirements.txt';
    const fixedFilePath = pathLib.resolve(
      workspacesPath,
      'with-custom-formatting/fixed-requirements.txt',
    );

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'django@1.6.1': {
            upgradeTo: 'django@2.0.1',
            vulns: [],
            upgrades: [],
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: [],
            upgrades: [],
          },
        },
      },
    };

    const entityToFix = {
      workspace: {
        readFile: async (path: string) => {
          return fs.readFileSync(
            pathLib.resolve(workspacesPath, path),
            'utf-8',
          );
        },
        writeFile: async (path: string, contents: string) => {
          const res = pathLib.parse(path);
          const fixedPath = pathLib.resolve(
            workspacesPath,
            res.dir,
            `fixed-${res.base}`,
          );
          filesToDelete = [fixedPath];
          fs.writeFileSync(fixedPath, contents, 'utf-8');
        },
      },
      scanResult: generateScanResult('pip', targetFile),
      testResult,
    };

    // Act
    const result = await snykFix.fix([entityToFix]);

    // Assert
    const expectedManifest =
      '\n#some comment\n\nDjango==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability\n';

    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptionsByScanType: {},
      resultsByPlugin: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [{ original: entityToFix, userMessage: 'TODO' }],
        },
      },
    });
  });

  it('ignores dependency name casing (treats all as lowercase)', async () => {
    // Arrange
    const targetFile = 'lower-case-dep/req.txt';
    const fixedFilePath = pathLib.resolve(
      workspacesPath,
      'lower-case-dep/fixed-req.txt',
    );

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'Django@1.6.1': {
            upgradeTo: 'Django@2.0.1',
            vulns: [],
            upgrades: [],
          },
        },
      },
    };

    const entityToFix = {
      workspace: {
        readFile: async (path: string) => {
          return fs.readFileSync(
            pathLib.resolve(workspacesPath, path),
            'utf-8',
          );
        },
        writeFile: async (path: string, contents: string) => {
          const res = pathLib.parse(path);
          const fixedPath = pathLib.resolve(
            workspacesPath,
            res.dir,
            `fixed-${res.base}`,
          );
          filesToDelete = [fixedPath];
          fs.writeFileSync(fixedPath, contents, 'utf-8');
        },
      },
      scanResult: generateScanResult('pip', targetFile),
      testResult,
    };

    // Act
    const result = await snykFix.fix([entityToFix]);

    // Assert
    const expectedManifest = 'django==2.0.1\n';

    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptionsByScanType: {},
      resultsByPlugin: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [{ original: entityToFix, userMessage: 'TODO' }],
        },
      },
    });
  });

  it('maintains package name casing when upgrading', async () => {
    // Arrange
    const targetFile = 'basic/prod.txt';
    const fixedFilePath = pathLib.resolve(
      workspacesPath,
      'basic/fixed-prod.txt',
    );

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'django@1.6.1': {
            // matches as the same when file has Django
            upgradeTo: 'django@2.0.1',
            vulns: [],
            upgrades: [],
          },
        },
      },
    };

    const entityToFix = {
      workspace: {
        readFile: async (path: string) => {
          return fs.readFileSync(
            pathLib.resolve(workspacesPath, path),
            'utf-8',
          );
        },
        writeFile: async (path: string, contents: string) => {
          const res = pathLib.parse(path);
          const fixedPath = pathLib.resolve(
            workspacesPath,
            res.dir,
            `fixed-${res.base}`,
          );
          filesToDelete = [fixedPath];
          fs.writeFileSync(fixedPath, contents, 'utf-8');
        },
      },
      scanResult: generateScanResult('pip', targetFile),
      testResult,
    };

    // Act
    const result = await snykFix.fix([entityToFix]);

    // Assert
    const expectedManifest = 'Django==2.0.1';

    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptionsByScanType: {},
      resultsByPlugin: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [{ original: entityToFix, userMessage: 'TODO' }],
        },
      },
    });
  });

  it('matches a package with multiple digit versions i.e. 12.123.14', async () => {
    // Arrange
    const targetFile = 'long-versions/prod.txt';
    const fixedFilePath = pathLib.resolve(
      workspacesPath,
      'long-versions/fixed-prod.txt',
    );

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'foo@12.123.14': {
            upgradeTo: 'foo@55.66.7',
            vulns: [],
            upgrades: [],
          },
        },
      },
    };

    const entityToFix = {
      workspace: {
        readFile: async (path: string) => {
          return fs.readFileSync(
            pathLib.resolve(workspacesPath, path),
            'utf-8',
          );
        },
        writeFile: async (path: string, contents: string) => {
          const res = pathLib.parse(path);
          const fixedPath = pathLib.resolve(
            workspacesPath,
            res.dir,
            `fixed-${res.base}`,
          );
          filesToDelete = [fixedPath];
          fs.writeFileSync(fixedPath, contents, 'utf-8');
        },
      },
      scanResult: generateScanResult('pip', targetFile),
      testResult,
    };

    // Act
    const result = await snykFix.fix([entityToFix]);

    // Assert
    const expectedManifest = 'foo==55.66.7\n';

    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptionsByScanType: {},
      resultsByPlugin: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [{ original: entityToFix, userMessage: 'TODO' }],
        },
      },
    });
  });

  it('maintains version comparator when upgrading', async () => {
    // Arrange
    const targetFile = 'with-comparator/prod.txt';
    const fixedFilePath = pathLib.resolve(
      workspacesPath,
      'with-comparator/fixed-prod.txt',
    );

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'django@1.6.1': {
            upgradeTo: 'django@2.0.1',
            vulns: [],
            upgrades: [],
          },
          'click@7.0': { upgradeTo: 'click@7.1', vulns: [], upgrades: [] },
        },
      },
    };

    const entityToFix = {
      workspace: {
        readFile: async (path: string) => {
          return fs.readFileSync(
            pathLib.resolve(workspacesPath, path),
            'utf-8',
          );
        },
        writeFile: async (path: string, contents: string) => {
          const res = pathLib.parse(path);
          const fixedPath = pathLib.resolve(
            workspacesPath,
            res.dir,
            `fixed-${res.base}`,
          );
          filesToDelete = [fixedPath];
          fs.writeFileSync(fixedPath, contents, 'utf-8');
        },
      },
      scanResult: generateScanResult('pip', targetFile),
      testResult,
    };

    // Act
    const result = await snykFix.fix([entityToFix]);

    // Assert
    const expectedManifest = 'django>=2.0.1\nclick>7.1\n';

    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptionsByScanType: {},
      resultsByPlugin: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [{ original: entityToFix, userMessage: 'TODO' }],
        },
      },
    });
  });
  it('retains python markers', async () => {
    // Arrange
    const targetFile = 'python-markers/prod.txt';
    const fixedFilePath = pathLib.resolve(
      workspacesPath,
      'python-markers/fixed-prod.txt',
    );

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'click@7.0': { upgradeTo: 'click@7.1', vulns: [], upgrades: [] },
        },
      },
    };

    const entityToFix = {
      workspace: {
        readFile: async (path: string) => {
          return fs.readFileSync(
            pathLib.resolve(workspacesPath, path),
            'utf-8',
          );
        },
        writeFile: async (path: string, contents: string) => {
          const res = pathLib.parse(path);
          const fixedPath = pathLib.resolve(
            workspacesPath,
            res.dir,
            `fixed-${res.base}`,
          );
          filesToDelete = [fixedPath];
          fs.writeFileSync(fixedPath, contents, 'utf-8');
        },
      },
      scanResult: generateScanResult('pip', targetFile),
      testResult,
    };

    // Act
    const result = await snykFix.fix([entityToFix]);

    // Assert
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toMatchSnapshot();
    expect(result).toMatchObject({
      exceptionsByScanType: {},
      resultsByPlugin: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [{ original: entityToFix, userMessage: 'TODO' }],
        },
      },
    });
  });
});
