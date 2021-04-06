import * as fs from 'fs';
import * as pathLib from 'path';

import * as snykFix from '../../../../../../src';
import { CommandFailedError } from '../../../../../../src/lib/errors/command-failed-to-run-error';
import { TestResult } from '../../../../../../src/types';
import {
  generateScanResult,
  generateTestResult,
} from '../../../../../helpers/generate-entity-to-fix';

describe('fix Pipfile Python projects', () => {
  let filesToDelete: string[] = [];
  afterEach(() => {
    filesToDelete.map((f) => fs.unlinkSync(f));
  });
  const workspacesPath = pathLib.resolve(__dirname, 'workspaces');

  it('shows expected changes with lockfile in --dry-run mode', async () => {
    // Arrange
    const targetFile = 'with-dev-deps/Pipfile';

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
      dryRun: true,
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
                  userMessage: 'Upgraded django from 1.6.1 to 2.0.1',
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

  it('applies expected changes to Pipfile when locking fails', async () => {
    // Arrange
    const targetFile = 'with-dev-deps/Pipfile';
    const expectedTargetFile = 'with-dev-deps/expected-Pipfile';

    const lockFile = 'with-dev-deps/Pipfile.lock';
    // backup original files
    backupFiles(workspacesPath, [targetFile, lockFile]);
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
      // stripAnsi: true,
    });
    // Assert
    // expect the updated file to match exactly expected file
    const fixedFileContent = fs.readFileSync(
      pathLib.join(workspacesPath, targetFile),
      'utf-8',
    );
    const expectedPipfileContent = fs.readFileSync(
      pathLib.join(workspacesPath, expectedTargetFile),
      'utf-8',
    );
    expect(fixedFileContent).toEqual(expectedPipfileContent);

    // verify versions in lockfiles
    const fixedLockfileContent = fs.readFileSync(
      pathLib.join(workspacesPath, lockFile),
      'utf-8',
    );

    const pipfileLockJson = JSON.parse(fixedLockfileContent);

    // lockfile still has original version
    expect(pipfileLockJson.default.django.version).toEqual('==1.6.1');

    // TODO: why is this error shape diff?
    // expect(result).toMatchObject({
    //   exceptions: {},
    //   results: {
    //     python: {
    //       failed: [
    //         {
    //           original: entityToFix,
    //           error: new CommandFailedError('Locking failed'),
    //           tip:
    //             'Try running `pipenv install django>=2.0.1 transitive>=1.1.1`',
    //         },
    //       ],
    //       skipped: [],
    //       succeeded: [],
    //     },
    //   },
    // });

    // restore original files
    restoreFiles(workspacesPath, [targetFile, lockFile]);
    filesToDelete = [
      pathLib.join(workspacesPath, 'with-dev-deps/Pipfile.orig'),
      pathLib.join(workspacesPath, 'with-dev-deps/Pipfile.lock.orig'),
    ];
  }, 70000);

  it('applies expected changes to Pipfile (100% success)', async () => {
    // Arrange
    const targetFile = 'with-django-upgrade/Pipfile';
    const expectedTargetFile = 'with-django-upgrade/expected-Pipfile';

    const lockFile = 'with-django-upgrade/Pipfile.lock';
    // backup original files
    backupFiles(workspacesPath, [targetFile, lockFile]);
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
      // stripAnsi: true,
    });
    // Assert
    // expect the updated file to match exactly expected file
    const fixedFileContent = fs.readFileSync(
      pathLib.join(workspacesPath, targetFile),
      'utf-8',
    );
    const expectedPipfileContent = fs.readFileSync(
      pathLib.join(workspacesPath, expectedTargetFile),
      'utf-8',
    );
    expect(fixedFileContent).toEqual(expectedPipfileContent);

    // verify versions in lockfiles
    const fixedLockfileContent = fs.readFileSync(
      pathLib.join(workspacesPath, lockFile),
      'utf-8',
    );

    const pipfileLockJson = JSON.parse(fixedLockfileContent);

    // lockfile still has original version
    expect(pipfileLockJson.default.django.version).toEqual('==2.0.1');

    expect(result).toMatchObject({
      exceptions: {},
      results: {
        python: {
          failed: [
          ],
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

    // restore original files
    restoreFiles(workspacesPath, [targetFile, lockFile]);
    filesToDelete = [
      pathLib.join(workspacesPath, 'with-django-upgrade/Pipfile.orig'),
      pathLib.join(workspacesPath, 'with-django-upgrade/Pipfile.lock.orig'),
    ];
  }, 90000);

  it.todo('Uses provided python interpreter if --command was used for test/fix');

  // it('does not add a lockfile if none was present (uses --skip-lock)    ', async () => {
  //   // Arrange
  //   const targetFile = 'basic/prod.txt';
  //   const fixedFilePath = pathLib.resolve(
  //     workspacesPath,
  //     'basic/fixed-prod.txt',
  //   );
  //   filesToDelete = [fixedFilePath];

  //   const testResult = {
  //     ...generateTestResult(),
  //     remediation: {
  //       unresolved: [],
  //       upgrade: {},
  //       patch: {},
  //       ignore: {},
  //       pin: {
  //         'django@1.6.1': {
  //           upgradeTo: 'django@2.0.1',
  //           vulns: [],
  //           isTransitive: false,
  //         },
  //         'transitive@1.0.0': {
  //           upgradeTo: 'transitive@1.1.1',
  //           vulns: [],
  //           isTransitive: true,
  //         },
  //       },
  //     },
  //   };

  //   const entityToFix = generateEntityToFix(
  //     workspacesPath,
  //     targetFile,
  //     testResult,
  //   );

  //   // Act
  //   const result = await snykFix.fix([entityToFix], {
  //     quiet: true,
  //     stripAnsi: true,
  //   });

  //   // Assert
  //   const expectedManifest =
  //     'Django==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability';
  //   // Note no extra newline was added to the expected manifest
  //   const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
  //   expect(fixedFileContent).toEqual(expectedManifest);
  //   expect(result).toMatch({
  //     exceptions: {},
  //     results: {
  //       python: {
  //         failed: [],
  //         skipped: [],
  //         succeeded: [
  //           {
  //             original: entityToFix,
  //             changes: [
  //               {
  //                 success: true,
  //                 userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
  //               },
  //               {
  //                 success: true,
  //                 userMessage: 'Pinned transitive from 1.0.0 to 1.1.1',
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     },
  //   });
  // });

  // it('passes down custom --python if the project was tested with this (--command) from CLI', async () => {
  //   //TODO: what about --three, --two
  //   // check current usage

  //   // Arrange
  //   const targetFile = 'basic-with-newline/prod.txt';
  //   const fixedFilePath = pathLib.resolve(
  //     workspacesPath,
  //     'basic-with-newline/fixed-prod.txt',
  //   );
  //   filesToDelete = [fixedFilePath];

  //   const testResult = {
  //     ...generateTestResult(),
  //     remediation: {
  //       unresolved: [],
  //       upgrade: {},
  //       patch: {},
  //       ignore: {},
  //       pin: {
  //         'django@1.6.1': {
  //           upgradeTo: 'django@2.0.1',
  //           vulns: [],
  //           isTransitive: false,
  //         },
  //         'transitive@1.0.0': {
  //           upgradeTo: 'transitive@1.1.1',
  //           vulns: [],
  //           isTransitive: true,
  //         },
  //         // in the manifest it is Clickhouse_Driver
  //         // but package name on Pypi is clickhouse-driver
  //         'clickhouse-driver@0.1.4': {
  //           upgradeTo: 'clickhouse-driver@0.1.5',
  //           vulns: [],
  //           isTransitive: true,
  //         },
  //       },
  //     },
  //   };

  //   const entityToFix = generateEntityToFix(
  //     workspacesPath,
  //     targetFile,
  //     testResult,
  //   );

  //   // Act
  //   const result = await snykFix.fix([entityToFix], {
  //     quiet: true,
  //     stripAnsi: true,
  //   });

  //   // Assert
  //   const expectedManifest =
  //     'Django==2.0.1\nClickhouse_Driver==0.1.5\nclickhouse-driver==0.1.5\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability\n';
  //   // Note no extra newline was added to the expected manifest
  //   const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
  //   expect(fixedFileContent).toEqual(expectedManifest);
  //   expect(result).toMatch({
  //     exceptions: {},
  //     results: {
  //       python: {
  //         failed: [],
  //         skipped: [],
  //         succeeded: [
  //           {
  //             original: entityToFix,
  //             changes: [
  //               {
  //                 success: true,
  //                 userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
  //               },
  //               {
  //                 success: true,
  //                 userMessage: 'Upgraded Clickhouse_Driver from 0.1.4 to 0.1.5',
  //               },
  //               {
  //                 success: true,
  //                 userMessage: 'Upgraded clickhouse-driver from 0.1.4 to 0.1.5',
  //               },
  //               {
  //                 success: true,
  //                 userMessage: 'Pinned transitive from 1.0.0 to 1.1.1',
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     },
  //   });
  // });

  // it('ignores dependency name casing (treats all as lowercase)', async () => {
  //   // Arrange
  //   const targetFile = 'lower-case-dep/req.txt';
  //   const fixedFilePath = pathLib.resolve(
  //     workspacesPath,
  //     'lower-case-dep/fixed-req.txt',
  //   );
  //   filesToDelete = [fixedFilePath];

  //   const testResult = {
  //     ...generateTestResult(),
  //     remediation: {
  //       unresolved: [],
  //       upgrade: {},
  //       patch: {},
  //       ignore: {},
  //       pin: {
  //         'Django@1.6.1': {
  //           upgradeTo: 'Django@2.0.1',
  //           vulns: [],
  //           isTransitive: false,
  //         },
  //       },
  //     },
  //   };

  //   const entityToFix = generateEntityToFix(
  //     workspacesPath,
  //     targetFile,
  //     testResult,
  //   );

  //   // Act
  //   const result = await snykFix.fix([entityToFix], {
  //     quiet: true,
  //     stripAnsi: true,
  //   });

  //   // Assert
  //   const expectedManifest = 'django==2.0.1\n';

  //   // Note no extra newline was added to the expected manifest
  //   const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
  //   expect(fixedFileContent).toEqual(expectedManifest);
  //   expect(result).toMatch({
  //     exceptions: {},
  //     results: {
  //       python: {
  //         failed: [],
  //         skipped: [],
  //         succeeded: [
  //           {
  //             original: entityToFix,
  //             changes: [
  //               {
  //                 success: true,
  //                 userMessage: 'Upgraded django from 1.6.1 to 2.0.1',
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     },
  //   });
  // });

  // it('maintains package name casing when upgrading', async () => {
  //   // Arrange
  //   const targetFile = 'basic/prod.txt';
  //   const fixedFilePath = pathLib.resolve(
  //     workspacesPath,
  //     'basic/fixed-prod.txt',
  //   );
  //   filesToDelete = [fixedFilePath];

  //   const testResult = {
  //     ...generateTestResult(),
  //     remediation: {
  //       unresolved: [],
  //       upgrade: {},
  //       patch: {},
  //       ignore: {},
  //       pin: {
  //         'django@1.6.1': {
  //           // matches as the same when file has Django
  //           upgradeTo: 'django@2.0.1',
  //           vulns: [],
  //           isTransitive: false,
  //         },
  //       },
  //     },
  //   };

  //   const entityToFix = generateEntityToFix(
  //     workspacesPath,
  //     targetFile,
  //     testResult,
  //   );

  //   // Act
  //   const result = await snykFix.fix([entityToFix], {
  //     quiet: true,
  //     stripAnsi: true,
  //   });

  //   // Assert
  //   const expectedManifest = 'Django==2.0.1';

  //   // Note no extra newline was added to the expected manifest
  //   const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
  //   expect(fixedFileContent).toEqual(expectedManifest);
  //   expect(result).toMatch({
  //     exceptions: {},
  //     results: {
  //       python: {
  //         failed: [],
  //         skipped: [],
  //         succeeded: [
  //           {
  //             original: entityToFix,
  //             changes: [
  //               {
  //                 success: true,
  //                 userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     },
  //   });
  // });

  // it('matches a package with multiple digit versions i.e. 12.123.14', async () => {
  //   // Arrange
  //   const targetFile = 'long-versions/prod.txt';
  //   const fixedFilePath = pathLib.resolve(
  //     workspacesPath,
  //     'long-versions/fixed-prod.txt',
  //   );
  //   filesToDelete = [fixedFilePath];

  //   const testResult = {
  //     ...generateTestResult(),
  //     remediation: {
  //       unresolved: [],
  //       upgrade: {},
  //       patch: {},
  //       ignore: {},
  //       pin: {
  //         'foo@12.123.14': {
  //           upgradeTo: 'foo@55.66.7',
  //           vulns: [],
  //           isTransitive: false,
  //         },
  //       },
  //     },
  //   };

  //   const entityToFix = generateEntityToFix(
  //     workspacesPath,
  //     targetFile,
  //     testResult,
  //   );

  //   // Act
  //   const result = await snykFix.fix([entityToFix], {
  //     quiet: true,
  //     stripAnsi: true,
  //   });

  //   // Assert
  //   const expectedManifest = 'foo==55.66.7\n';

  //   // Note no extra newline was added to the expected manifest
  //   const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
  //   expect(fixedFileContent).toEqual(expectedManifest);
  //   expect(result).toMatch({
  //     exceptions: {},
  //     results: {
  //       python: {
  //         failed: [],
  //         skipped: [],
  //         succeeded: [
  //           {
  //             original: entityToFix,
  //             changes: [
  //               {
  //                 success: true,
  //                 userMessage: 'Upgraded foo from 12.123.14 to 55.66.7',
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     },
  //   });
  // });

  // it.skip('maintains version comparator when upgrading', async () => {
  //   // This is not currently possible until we
  //   // can parse the Pipfile and adjust the version in there directly
  // });
  // it('retains python & system markers', async () => {
  //   // Arrange
  //   const targetFile = 'python-markers/prod.txt';
  //   const fixedFilePath = pathLib.resolve(
  //     workspacesPath,
  //     'python-markers/fixed-prod.txt',
  //   );

  //   filesToDelete = [fixedFilePath];
  //   const testResult = {
  //     ...generateTestResult(),
  //     remediation: {
  //       unresolved: [],
  //       upgrade: {},
  //       patch: {},
  //       ignore: {},
  //       pin: {
  //         'click@7.0': {
  //           upgradeTo: 'click@7.1',
  //           vulns: [],
  //           isTransitive: false,
  //         },
  //       },
  //     },
  //   };

  //   const entityToFix = generateEntityToFix(
  //     workspacesPath,
  //     targetFile,
  //     testResult,
  //   );

  //   // Act
  //   const result = await snykFix.fix([entityToFix], {
  //     quiet: true,
  //     stripAnsi: true,
  //   });

  //   // Assert
  //   const fixedFileContent = fs.readFileSync(fixedFilePath, 'utf-8');
  //   expect(fixedFileContent).toMatchSnapshot();
  //   expect(result).toMatch({
  //     exceptions: {},
  //     results: {
  //       python: {
  //         failed: [],
  //         skipped: [],
  //         succeeded: [
  //           {
  //             original: entityToFix,
  //             changes: [
  //               {
  //                 success: true,
  //                 userMessage: 'Upgraded click from 7.0 to 7.1',
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     },
  //   });
  // });
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
    options: {
      command: 'python3',
    },
    workspace: {
      path: workspacesPath,
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

function backupFiles(root: string, files: string[]): void {
  for (const file of files) {
    const fullPath = pathLib.join(root, file);
    fs.copyFileSync(fullPath, `${fullPath}.orig`);
  }
}

function restoreFiles(root: string, files: string[]): void {
  for (const file of files) {
    const orig = pathLib.join(root, `${file}.orig`);
    const restore = pathLib.join(root, file);
    fs.copyFileSync(orig, restore);
  }
}
