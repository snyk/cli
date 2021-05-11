import * as fs from 'fs';
import * as pathLib from 'path';
import * as pipenvPipfileFix from '@snyk/fix-pipenv-pipfile';

import * as snykFix from '../../../../../../src';
import { TestResult } from '../../../../../../src/types';
import {
  generateScanResult,
  generateTestResult,
} from '../../../../../helpers/generate-entity-to-fix';

jest.mock('@snyk/fix-pipenv-pipfile');

describe('fix Pipfile Python projects', () => {
  beforeAll(() => {
    jest.spyOn(pipenvPipfileFix, 'isPipenvSupportedVersion').mockReturnValue({
      supported: true,
      versions: ['123.123.123'],
    });
    jest.spyOn(pipenvPipfileFix, 'isPipenvInstalled').mockResolvedValue({
      version: '123.123.123',
    });
  });

  const workspacesPath = pathLib.resolve(__dirname, 'workspaces');

  it('shows expected changes with lockfile in --dry-run mode', async () => {
    jest.spyOn(pipenvPipfileFix, 'pipenvInstall').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      command: 'pipenv install',
      duration: 123,
    });
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

  // FYI: on later pipenv versions the Pipfile changes are also not present of locking failed
  it('applies expected changes to Pipfile when locking fails', async () => {
    jest.spyOn(pipenvPipfileFix, 'pipenvInstall').mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'Locking Failed',
      command: 'pipenv install django==2.0.1 transitive==1.1.1',
      duration: 123,
    });

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
            vulns: ['vuln-id'],
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
          failed: [
            {
              original: entityToFix,
              error: expect.objectContaining({ name: 'CommandFailedError' }),
              tip:
                'Try running `pipenv install django==2.0.1 transitive==1.1.1`',
            },
          ],
          skipped: [],
          succeeded: [],
        },
      },
    });
    expect(result.fixSummary).toContain('✖ Locking failed');
    expect(result.fixSummary).toContain(
      'Tip:     Try running `pipenv install django==2.0.1 transitive==1.1.1`',
    );
    expect(result.fixSummary).toContain('0 items were successfully fixed');
    expect(result.fixSummary).toContain('0 fixed issues');
  });

  it('applies expected changes to Pipfile (100% success)', async () => {
    jest.spyOn(pipenvPipfileFix, 'pipenvInstall').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      command: 'pipenv install django==2.0.1',
      duration: 123,
    });
    // Arrange
    const targetFile = 'with-django-upgrade/Pipfile';
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
            vulns: ['vuln-id'],
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
    expect(result.fixSummary).toContain(
      '✔ Upgraded django from 1.6.1 to 2.0.1',
    );
    expect(result.fixSummary).toContain('1 items were successfully fixed');
    expect(result.fixSummary).toContain('1 fixed issues');
  });

  it('passes down custom --python if the project was tested with this (--command) from CLI', async () => {
    const install = jest
      .spyOn(pipenvPipfileFix, 'pipenvInstall')
      .mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: '',
        command: 'pipenv install django==2.0.1 --python ',
        duration: 123,
      });
    // Arrange
    const targetFile = 'with-django-upgrade/Pipfile';
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
            vulns: ['vuln-id'],
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

    entityToFix.options.command = 'python3';
    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });

    // Assert

    expect(install.mock.calls[0][0]).toMatch(workspacesPath);
    expect(install.mock.calls[0][1]).toEqual([
      'django==2.0.1',
      'transitive==1.1.1',
    ]);
    expect(install.mock.calls[0][2]).toEqual({ python: 'python3' });

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
    expect(result.fixSummary).toContain(
      '✔ Upgraded django from 1.6.1 to 2.0.1',
    );
    expect(result.fixSummary).toContain('1 items were successfully fixed');
    expect(result.fixSummary).toContain('1 fixed issues');
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
