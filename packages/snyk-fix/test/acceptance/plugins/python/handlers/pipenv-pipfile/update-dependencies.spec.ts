import * as pathLib from 'path';
import * as pipenvPipfileFix from '@snyk/fix-pipenv-pipfile';

import * as snykFix from '../../../../../../src';

import {
  generateEntityToFixWithFileReadWrite,
  generateTestResult,
} from '../../../../../helpers/generate-entity-to-fix';

jest.mock('@snyk/fix-pipenv-pipfile');

describe('fix Pipfile Python projects', () => {
  let pipenvPipfileFixStub: jest.SpyInstance;
  beforeAll(() => {
    jest.spyOn(pipenvPipfileFix, 'isPipenvSupportedVersion').mockReturnValue({
      supported: true,
      versions: ['123.123.123'],
    });
    jest.spyOn(pipenvPipfileFix, 'isPipenvInstalled').mockResolvedValue({
      version: '123.123.123',
    });
  });

  beforeEach(() => {
    pipenvPipfileFixStub = jest.spyOn(pipenvPipfileFix, 'pipenvInstall');
  });

  afterEach(() => {
    pipenvPipfileFixStub.mockClear();
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

    const entityToFix = generateEntityToFixWithFileReadWrite(
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
    expect(pipenvPipfileFixStub).toHaveBeenCalledTimes(0);
  });

  // FYI: on later pipenv versions the Pipfile changes are also not present of locking failed
  it('applies expected changes to Pipfile when locking fails', async () => {
    jest.spyOn(pipenvPipfileFix, 'pipenvInstall').mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'Locking failed',
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

    const entityToFix = generateEntityToFixWithFileReadWrite(
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
              error: expect.objectContaining({
                name: 'NoFixesCouldBeAppliedError',
              }),
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
    expect(result.fixSummary).toContain('✖ No successful fixes');
    expect(pipenvPipfileFixStub).toHaveBeenCalledTimes(1);
    expect(pipenvPipfileFixStub).toHaveBeenCalledWith(
      pathLib.resolve(workspacesPath, 'with-dev-deps'),
      ['django==2.0.1', 'transitive==1.1.1'],
      {
        python: 'python3',
      },
    );
  });

  it('applies expected changes to Pipfile when install fails', async () => {
    jest.spyOn(pipenvPipfileFix, 'pipenvInstall').mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: `Updating dependenciesResolving dependencies... (1.1s)

      SolverProblemError

      Because django (2.6) depends on numpy (>=1.19)and tensorflow (2.2.1) depends on numpy (>=1.16.0,<1.19.0), django (2.6) is incompatible with tensorflow (2.2.1).So, because pillow depends on both tensorflow (2.2.1) and django (2.6), version solving failed.`,
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

    const entityToFix = generateEntityToFixWithFileReadWrite(
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
              error: expect.objectContaining({
                name: 'NoFixesCouldBeAppliedError',
              }),
              tip:
                'Try running `pipenv install django==2.0.1 transitive==1.1.1`',
            },
          ],
          skipped: [],
          succeeded: [],
        },
      },
    });
    expect(result.fixSummary).toContain('version solving failed');
    expect(result.fixSummary).toContain(
      'Tip:     Try running `pipenv install django==2.0.1 transitive==1.1.1`',
    );
    expect(result.fixSummary).toContain('✖ No successful fixes');
    expect(pipenvPipfileFixStub).toHaveBeenCalledTimes(1);
    expect(pipenvPipfileFixStub).toHaveBeenCalledWith(
      pathLib.resolve(workspacesPath, 'with-dev-deps'),
      ['django==2.0.1', 'transitive==1.1.1'],
      {
        python: 'python3',
      },
    );
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

    const entityToFix = generateEntityToFixWithFileReadWrite(
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
    expect(result.fixSummary).toContain('1 issues were successfully fixed');
    expect(pipenvPipfileFixStub).toHaveBeenCalledTimes(1);
    expect(pipenvPipfileFixStub).toHaveBeenCalledWith(
      pathLib.resolve(workspacesPath, 'with-django-upgrade'),
      ['django==2.0.1'],
      {
        python: 'python3',
      },
    );
  });

  it('passes down custom --python if the project was tested with this (--command) from CLI', async () => {
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

    const entityToFix = generateEntityToFixWithFileReadWrite(
      workspacesPath,
      targetFile,
      testResult,
    );

    entityToFix.options.command = 'python2';
    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
    });

    // Assert
    expect(pipenvPipfileFixStub).toHaveBeenCalledTimes(1);
    expect(pipenvPipfileFixStub).toHaveBeenCalledWith(
      pathLib.resolve(workspacesPath, 'with-django-upgrade'),
      ['django==2.0.1'],
      {
        python: 'python2',
      },
    );

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
    expect(result.fixSummary).toContain('1 issues were successfully fixed');
  });
});

describe('fix Pipfile Python projects (fix sequentially)', () => {
  let pipenvPipfileFixStub: jest.SpyInstance;
  beforeAll(() => {
    jest.spyOn(pipenvPipfileFix, 'isPipenvSupportedVersion').mockReturnValue({
      supported: true,
      versions: ['123.123.123'],
    });
    jest.spyOn(pipenvPipfileFix, 'isPipenvInstalled').mockResolvedValue({
      version: '123.123.123',
    });
  });

  beforeEach(() => {
    pipenvPipfileFixStub = jest.spyOn(pipenvPipfileFix, 'pipenvInstall');
  });

  afterEach(() => {
    pipenvPipfileFixStub.mockClear();
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

    const entityToFix = generateEntityToFixWithFileReadWrite(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
      dryRun: true,
      sequentialFix: true,
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
    expect(pipenvPipfileFixStub).toHaveBeenCalledTimes(0);
  });

  // FYI: on later pipenv versions the Pipfile changes are also not present of locking failed
  it('applies expected changes to Pipfile when locking fails', async () => {
    jest.spyOn(pipenvPipfileFix, 'pipenvInstall').mockResolvedValueOnce({
      exitCode: 1,
      stdout: '',
      stderr: 'Locking failed',
      command: 'pipenv install django==2.0.1',
      duration: 123,
    });

    jest.spyOn(pipenvPipfileFix, 'pipenvInstall').mockResolvedValueOnce({
      exitCode: 0,
      stdout: '',
      stderr: '',
      command: 'poetry install transitive==1.1.1',
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

    const entityToFix = generateEntityToFixWithFileReadWrite(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
      sequentialFix: true,
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
                  from: 'django@1.6.1',
                  issueIds: ['vuln-id'],
                  reason: 'Locking failed',
                  success: false,
                  tip: 'Try running `pipenv install django==2.0.1`',
                  to: 'django@2.0.1',
                  userMessage: 'Failed to upgrade django from 1.6.1 to 2.0.1',
                },
                {
                  from: 'transitive@1.0.0',
                  issueIds: [],
                  success: true,
                  to: 'transitive@1.1.1',
                  userMessage: 'Pinned transitive from 1.0.0 to 1.1.1',
                },
              ],
            },
          ],
        },
      },
    });
    expect(result.fixSummary).toContain('Locking failed');
    expect(result.fixSummary).toContain(
      'Tip:     Try running `pipenv install django==2.0.1`',
    );
    expect(result.fixSummary).toContain(
      '✔ Pinned transitive from 1.0.0 to 1.1.1',
    );
    expect(pipenvPipfileFixStub).toHaveBeenCalledTimes(2);
    expect(pipenvPipfileFixStub).toHaveBeenCalledWith(
      pathLib.resolve(workspacesPath, 'with-dev-deps'),
      ['django==2.0.1'],
      {
        python: 'python3',
      },
    );
    expect(pipenvPipfileFixStub).toHaveBeenCalledWith(
      pathLib.resolve(workspacesPath, 'with-dev-deps'),
      ['transitive==1.1.1'],
      {
        python: 'python3',
      },
    );
  });

  it('applies expected changes to Pipfile when install fails', async () => {
    jest.spyOn(pipenvPipfileFix, 'pipenvInstall').mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: `Updating dependenciesResolving dependencies... (1.1s)

      SolverProblemError

      Because django (2.6) depends on numpy (>=1.19)and tensorflow (2.2.1) depends on numpy (>=1.16.0,<1.19.0), django (2.6) is incompatible with tensorflow (2.2.1).So, because pillow depends on both tensorflow (2.2.1) and django (2.6), version solving failed.`,
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

    const entityToFix = generateEntityToFixWithFileReadWrite(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
      sequentialFix: true,
    });
    // Assert
    expect(result).toMatchObject({
      exceptions: {},
      results: {
        python: {
          failed: [
            {
              original: entityToFix,
              error: expect.objectContaining({
                name: 'NoFixesCouldBeAppliedError',
              }),
              tip:
                'Try running `pipenv install django==2.0.1 transitive==1.1.1`',
            },
          ],
          skipped: [],
          succeeded: [],
        },
      },
    });
    expect(result.fixSummary).toContain('version solving failed');
    expect(result.fixSummary).toContain(
      'Tip:     Try running `pipenv install django==2.0.1 transitive==1.1.1`',
    );
    expect(result.fixSummary).toContain('✖ No successful fixes');
    expect(pipenvPipfileFixStub).toHaveBeenCalledTimes(2);
    expect(pipenvPipfileFixStub).toHaveBeenCalledWith(
      pathLib.resolve(workspacesPath, 'with-dev-deps'),
      ['django==2.0.1'],
      {
        python: 'python3',
      },
    );
    expect(pipenvPipfileFixStub).toHaveBeenCalledWith(
      pathLib.resolve(workspacesPath, 'with-dev-deps'),
      ['transitive==1.1.1'],
      {
        python: 'python3',
      },
    );
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

    const entityToFix = generateEntityToFixWithFileReadWrite(
      workspacesPath,
      targetFile,
      testResult,
    );

    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
      sequentialFix: true,
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
    expect(result.fixSummary).toContain('1 issues were successfully fixed');
    expect(pipenvPipfileFixStub).toHaveBeenCalledTimes(1);
    expect(pipenvPipfileFixStub).toHaveBeenCalledWith(
      pathLib.resolve(workspacesPath, 'with-django-upgrade'),
      ['django==2.0.1'],
      {
        python: 'python3',
      },
    );
  });

  it('passes down custom --python if the project was tested with this (--command) from CLI', async () => {
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

    const entityToFix = generateEntityToFixWithFileReadWrite(
      workspacesPath,
      targetFile,
      testResult,
    );

    entityToFix.options.command = 'python2';
    // Act
    const result = await snykFix.fix([entityToFix], {
      quiet: true,
      stripAnsi: true,
      sequentialFix: true,
    });

    // Assert
    expect(pipenvPipfileFixStub).toHaveBeenCalledTimes(1);
    expect(pipenvPipfileFixStub).toHaveBeenCalledWith(
      pathLib.resolve(workspacesPath, 'with-django-upgrade'),
      ['django==2.0.1'],
      {
        python: 'python2',
      },
    );

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
    expect(result.fixSummary).toContain('1 issues were successfully fixed');
  });
});
