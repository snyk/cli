import * as fs from 'fs';
import * as pathLib from 'path';
import * as snykFix from '../../../../../src';
import { selectFileForPinning } from '../../../../../src/plugins/python/handlers/pip-requirements';
import { TestResult } from '../../../../../src/types';
import {
  generateScanResult,
  generateTestResult,
} from '../../../../helpers/generate-entity-to-fix';

describe('selectFileForPinning', () => {
  const workspacesPath = pathLib.resolve(__dirname, 'workspaces');

  it('with a -r option chooses targetFile', async () => {
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
            isTransitive: false,
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: [],
            isTransitive: true,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const { fileName, fileContent } = await selectFileForPinning(entityToFix);
    // Assert
    expect(fileName).toEqual('dev.txt');
    expect(fileContent).toEqual(
      fs.readFileSync(pathLib.resolve(workspacesPath, targetFile), 'utf-8'),
    );
  });
  it('without -r or -c option chooses targetFile', async () => {
    // Arrange
    const targetFile = 'basic/prod.txt';

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
            isTransitive: false,
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: [],
            isTransitive: true,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const { fileName, fileContent } = await selectFileForPinning(entityToFix);
    // Assert
    expect(fileName).toEqual('prod.txt');
    expect(fileContent).toEqual(
      fs.readFileSync(pathLib.resolve(workspacesPath, targetFile), 'utf-8'),
    );
  });
  it('with a -c option chooses constraints.txt file', async () => {
    // Arrange
    const targetFile = 'app-with-constraints/requirements.txt';

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
            isTransitive: false,
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: [],
            isTransitive: true,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const { fileName, fileContent } = await selectFileForPinning(entityToFix);
    // Assert
    expect(fileName).toEqual('constraints.txt');
    expect(fileContent).toEqual(
      fs.readFileSync(
        pathLib.resolve(workspacesPath, 'app-with-constraints/constraints.txt'),
        'utf-8',
      ),
    );
  });
});
describe('fix *req*.txt / *.txt Python projects', () => {
  let filesToDelete: string[] = [];
  afterEach(() => {
    filesToDelete.map((f) => fs.unlinkSync(f));
  });
  const workspacesPath = pathLib.resolve(__dirname, 'workspaces');

  it('fixes project with a -r option', async () => {
    // Arrange
    const targetFile = 'with-require/dev.txt';
    filesToDelete = [
      pathLib.join(workspacesPath, 'with-require/fixed-dev.txt'),
    ];

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
            isTransitive: false,
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: [],
            isTransitive: true,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });
    // Assert
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                },
                {
                  success: true,
                  userMessage: 'Pinned transitive from 1.0.0 to 1.1.1',
                },
              ],
            },
          ],
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
    filesToDelete = [fixedFilePath];

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
            isTransitive: false,
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: [],
            isTransitive: true,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });

    // Assert
    const expectedManifest =
      'Django==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability';
    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                },
                {
                  success: true,
                  userMessage: 'Pinned transitive from 1.0.0 to 1.1.1',
                },
              ],
            },
          ],
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
    filesToDelete = [fixedFilePath];

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
            isTransitive: false,
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: [],
            isTransitive: true,
          },
          // in the manifest it is Clickhouse_Driver
          // but package name on Pypi is clickhouse-driver
          'clickhouse-driver@0.1.4': {
            upgradeTo: 'clickhouse-driver@0.1.5',
            vulns: [],
            isTransitive: true,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });

    // Assert
    const expectedManifest =
      'Django==2.0.1\nClickhouse_Driver==0.1.5\nclickhouse-driver==0.1.5\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability\n';
    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                },
                {
                  success: true,
                  userMessage: 'Upgraded Clickhouse_Driver from 0.1.4 to 0.1.5',
                },
                {
                  success: true,
                  userMessage: 'Upgraded clickhouse-driver from 0.1.4 to 0.1.5',
                },
                {
                  success: true,
                  userMessage: 'Pinned transitive from 1.0.0 to 1.1.1',
                },
              ],
            },
          ],
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
    filesToDelete = [fixedFilePath];

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
            isTransitive: false,
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: [],
            isTransitive: true,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });

    // Assert
    const expectedManifest =
      '\n#some comment\n\nDjango==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability\n';

    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                },
                {
                  success: true,
                  userMessage: 'Pinned transitive from 1.0.0 to 1.1.1',
                },
              ],
            },
          ],
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
    filesToDelete = [fixedFilePath];

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
            isTransitive: false,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });

    // Assert
    const expectedManifest = 'django==2.0.1\n';

    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage: 'Upgraded django from 1.6.1 to 2.0.1',
                },
              ],
            },
          ],
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
    filesToDelete = [fixedFilePath];

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
            isTransitive: false,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });

    // Assert
    const expectedManifest = 'Django==2.0.1';

    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                },
              ],
            },
          ],
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
    filesToDelete = [fixedFilePath];

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
            isTransitive: false,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });

    // Assert
    const expectedManifest = 'foo==55.66.7\n';

    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage: 'Upgraded foo from 12.123.14 to 55.66.7',
                },
              ],
            },
          ],
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
    filesToDelete = [fixedFilePath];

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
            isTransitive: false,
          },
          'click@7.0': {
            upgradeTo: 'click@7.1',
            vulns: [],
            isTransitive: false,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });

    // Assert
    const expectedManifest = 'django>=2.0.1\nclick>7.1\n';

    // Note no extra newline was added to the expected manifest
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toEqual(expectedManifest);
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage: 'Upgraded django from 1.6.1 to 2.0.1',
                },
                {
                  success: true,
                  userMessage: 'Upgraded click from 7.0 to 7.1',
                },
              ],
            },
          ],
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

    filesToDelete = [fixedFilePath];
    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'click@7.0': {
            upgradeTo: 'click@7.1',
            vulns: [],
            isTransitive: false,
          },
        },
      },
    };

    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });

    // Assert
    const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
    expect(fixedFileContent).toMatchSnapshot();
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        python: {
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage: 'Upgraded click from 7.0 to 7.1',
                },
              ],
            },
          ],
        },
      },
    });
  });
  it('fixes multiple files that are included via -r', async () => {
    // Arrange
    const targetFile = 'pip-app/requirements.txt';
    filesToDelete = [
      pathLib.resolve(workspacesPath, 'pip-app/fixed-requirements.txt'),
      pathLib.resolve(workspacesPath, 'pip-app/fixed-base2.txt'),
    ];
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
            isTransitive: false,
          },
          'Jinja2@2.7.2': {
            upgradeTo: 'Jinja2@2.7.3',
            vulns: [],
            isTransitive: true,
          },
        },
      },
    };
    const entityToFix = generateEntityToFix(
      workspacesPath,
      targetFile,
      testResult,
    );
    const writeFileSpy = jest.spyOn(entityToFix.workspace, 'writeFile');

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });

    // 2 files needed to have changes
    expect(writeFileSpy).toHaveBeenCalledTimes(2);
    expect(result.results.python.succeeded[0].original).toEqual(entityToFix);
    expect(result.results.python.succeeded[0].changes).toMatchSnapshot();
  });
  it('fixes multiple files via -r with the same name (some were already fixed)', async () => {
    // Arrange
    const targetFile1 = 'app-with-already-fixed/requirements.txt';
    const targetFile2 = 'app-with-already-fixed/lib/requirements.txt';
    const targetFile3 = 'app-with-already-fixed/core/requirements.txt';

    filesToDelete = [
      pathLib.resolve(
        workspacesPath,
        'app-with-already-fixed/fixed-requirements.txt',
      ),
      pathLib.resolve(
        workspacesPath,
        'app-with-already-fixed/lib/fixed-requirements.txt',
      ),
      pathLib.resolve(
        workspacesPath,
        'app-with-already-fixed/core/fixed-requirements.txt',
      ),
    ];
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
            isTransitive: false,
          },
          'Jinja2@2.7.2': {
            upgradeTo: 'Jinja2@2.7.3',
            vulns: [],
            isTransitive: true,
          },
        },
      },
    };
    const entityToFix1 = generateEntityToFix(
      workspacesPath,
      targetFile1,
      testResult,
    );
    const entityToFix2 = generateEntityToFix(
      workspacesPath,
      targetFile2,
      testResult,
    );
    const entityToFix3 = generateEntityToFix(
      workspacesPath,
      targetFile3,
      testResult,
    );
    const writeFileSpy = jest.spyOn(entityToFix1.workspace, 'writeFile');
    // Act
    const result = await snykFix.fix(
      [entityToFix2, entityToFix3, entityToFix1],
      {
        quiet: true,
        stripAnsi: true,
      },
    );
    const requirements = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-already-fixed/fixed-requirements.txt',
      ),
      'utf-8',
    );
    const expectedRequirements = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-already-fixed/expected-requirements.txt',
      ),
      'utf-8',
    );
    const libRequirements = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-already-fixed/lib/fixed-requirements.txt',
      ),
      'utf-8',
    );
    const ExpectedLibRequirements = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-already-fixed/lib/expected-requirements.txt',
      ),
      'utf-8',
    );
    const coreRequirements = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-already-fixed/core/fixed-requirements.txt',
      ),
      'utf-8',
    );
    const expectedCoreRequirements = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-already-fixed/core/fixed-requirements.txt',
      ),
      'utf-8',
    );

    expect(requirements).toEqual(expectedRequirements);
    expect(libRequirements).toEqual(ExpectedLibRequirements);
    expect(coreRequirements).toEqual(expectedCoreRequirements);
    // 3 files needed to have changes
    expect(result.fixSummary).toMatchSnapshot();
    expect(writeFileSpy).toHaveBeenCalledTimes(3);
    expect(result.results.python.succeeded[0].original).toEqual(entityToFix1);
    expect(result.results.python.succeeded[0].changes).toMatchSnapshot();
  });
  it('fixes multiple files via -c & -r with the same name (some were already fixed)', async () => {
    // Arrange
    const targetFile1 = 'app-with-constraints/requirements.txt';
    const targetFile2 = 'app-with-constraints/lib/requirements.txt';

    filesToDelete = [
      pathLib.resolve(
        workspacesPath,
        'app-with-constraints/fixed-requirements.txt',
      ),
      pathLib.resolve(
        workspacesPath,
        'app-with-constraints/lib/fixed-requirements.txt',
      ),
      pathLib.resolve(
        workspacesPath,
        'app-with-constraints/fixed-constraints.txt',
      ),
    ];
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
            isTransitive: false,
          },
          'Jinja2@2.7.2': {
            upgradeTo: 'Jinja2@2.7.3',
            vulns: [],
            isTransitive: true,
          },
          'transitive@1.0.1': {
            upgradeTo: 'transitive@2.0.1',
            vulns: [],
            isTransitive: true,
          },
        },
      },
    };
    const entityToFix1 = generateEntityToFix(
      workspacesPath,
      targetFile1,
      testResult,
    );
    const entityToFix2 = generateEntityToFix(
      workspacesPath,
      targetFile2,
      testResult,
    );
    const writeFileSpy = jest.spyOn(entityToFix1.workspace, 'writeFile');
    // Act
    const result = await snykFix.fix([entityToFix2, entityToFix1], {
      quiet: true,
      stripAnsi: true,
    });

    const requirements = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-constraints/fixed-requirements.txt',
      ),
      'utf-8',
    );
    const expectedRequirements = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-constraints/expected-requirements.txt',
      ),
      'utf-8',
    );
    const libRequirements = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-constraints/lib/fixed-requirements.txt',
      ),
      'utf-8',
    );
    const ExpectedLibRequirements = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-constraints/lib/expected-requirements.txt',
      ),
      'utf-8',
    );
    const constraints = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-constraints/fixed-constraints.txt',
      ),
      'utf-8',
    );
    const expectedConstraints = fs.readFileSync(
      pathLib.resolve(
        workspacesPath,
        'app-with-constraints/expected-constraints.txt',
      ),
      'utf-8',
    );
    expect(requirements).toEqual(expectedRequirements);
    expect(libRequirements).toEqual(ExpectedLibRequirements);
    expect(constraints).toEqual(expectedConstraints);
    expect(result.fixSummary).toMatchSnapshot();
    // 3 files with upgrades + 1 more to apply pins
    expect(writeFileSpy).toHaveBeenCalledTimes(4);
    expect(result.results.python.succeeded[0].original).toEqual(entityToFix1);
    expect(result.results.python.succeeded[1].original).toEqual(entityToFix2);
    expect(result.results.python.succeeded[0].changes).toMatchSnapshot();
    expect(result.results.python.succeeded[1].changes).toMatchSnapshot();
  });
});

function readFileHelper(workspacesPath: string, path: string): string {
  // because we write multiple time the file
  // may be have already been updated in fixed-* name
  // so try read that first
  const res = pathLib.parse(path);
  const fixedPath = pathLib.resolve(
    workspacesPath,
    res.dir,
    `fixed-${res.base}`,
  );
  let file;
  try {
    file = fs.readFileSync(fixedPath, 'utf-8');
  } catch (e) {
    file = fs.readFileSync(pathLib.resolve(workspacesPath, path), 'utf-8');
  }
  return file;
}

function generateEntityToFix(
  workspacesPath: string,
  targetFile: string,
  testResult: TestResult,
): snykFix.EntityToFix {
  const entityToFix = {
    workspace: {
      readFile: async (path: string) => {
        return readFileHelper(workspacesPath, path);
      },
      writeFile: async (path: string, contents: string) => {
        const res = pathLib.parse(path);
        const fixedPath = pathLib.resolve(
          workspacesPath,
          res.dir,
          `fixed-${res.base}`,
        );
        fs.writeFileSync(fixedPath, contents, 'utf-8');
      },
    },
    scanResult: generateScanResult('pip', targetFile),
    testResult,
  };
  return entityToFix;
}
