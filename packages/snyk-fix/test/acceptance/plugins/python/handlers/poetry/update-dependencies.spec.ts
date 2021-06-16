import * as pathLib from 'path';
import * as poetryFix from '@snyk/fix-poetry';

import * as snykFix from '../../../../../../src';
import {
  generateEntityToFixWithFileReadWrite,
  generateTestResult,
} from '../../../../../helpers/generate-entity-to-fix';

jest.mock('@snyk/fix-poetry');

describe('fix Poetry Python projects', () => {
  let poetryFixStub: jest.SpyInstance;
  beforeAll(() => {
    jest.spyOn(poetryFix, 'isPoetrySupportedVersion').mockReturnValue({
      supported: true,
      versions: ['1.1.1'],
    });
    jest.spyOn(poetryFix, 'isPoetryInstalled').mockResolvedValue({
      version: '1.1.1',
    });
  });

  beforeEach(() => {
    poetryFixStub = jest.spyOn(poetryFix, 'poetryAdd');
  });

  afterEach(() => {
    poetryFixStub.mockClear();
  });

  const workspacesPath = pathLib.resolve(__dirname, 'workspaces');

  it('shows expected changes with lockfile in --dry-run mode', async () => {
    jest.spyOn(poetryFix, 'poetryAdd').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      command: 'poetry install',
      duration: 123,
    });
    // Arrange
    const targetFile = 'simple/pyproject.toml';

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'six@1.1.6': {
            upgradeTo: 'six@2.0.1',
            vulns: ['VULN-six'],
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
                  userMessage: 'Upgraded six from 1.1.6 to 2.0.1',
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
    expect(poetryFixStub.mock.calls).toHaveLength(0);
  });

  it('Calls the plugin with expected parameters (upgrade & pin)', async () => {
    jest.spyOn(poetryFix, 'poetryAdd').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      command: 'poetry install',
      duration: 123,
    });
    // Arrange
    const targetFile = 'simple/pyproject.toml';

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'six@1.1.6': {
            upgradeTo: 'six@2.0.1',
            vulns: ['VULN-six'],
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
          failed: [],
          skipped: [],
          succeeded: [
            {
              original: entityToFix,
              changes: [
                {
                  success: true,
                  userMessage: 'Upgraded six from 1.1.6 to 2.0.1',
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
    expect(poetryFixStub.mock.calls).toHaveLength(1);
    expect(poetryFixStub.mock.calls[0]).toEqual([
      pathLib.resolve(workspacesPath, 'simple'),
      ['six==2.0.1', 'transitive==1.1.1'],
      {
        python: 'python3',
      },
    ]);
  });

  it('Calls the plugin with expected parameters with --dev (upgrade & pin)', async () => {
    jest.spyOn(poetryFix, 'poetryAdd').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      command: 'poetry install',
      duration: 123,
    });
    // Arrange
    const targetFile = 'simple/pyproject.toml';

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'six@1.1.6': {
            upgradeTo: 'six@2.0.1',
            vulns: ['VULN-six'],
            isTransitive: false,
          },
          'transitive@1.0.0': {
            upgradeTo: 'transitive@1.1.1',
            vulns: ['vuln-transitive'],
            isTransitive: true,
          },
          'json-api@0.1.21': {
            upgradeTo: 'json-api@0.1.22',
            vulns: ['SNYK-1'],
            isTransitive: false,
          },
        },
      },
    };

    const entityToFix = generateEntityToFixWithFileReadWrite(
      workspacesPath,
      targetFile,
      testResult,
      {
        dev: true,
      },
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
                  userMessage: 'Upgraded six from 1.1.6 to 2.0.1',
                },
                {
                  success: true,
                  userMessage: 'Pinned transitive from 1.0.0 to 1.1.1',
                },
                {
                  success: true,
                  userMessage: 'Upgraded json-api from 0.1.21 to 0.1.22',
                },
              ],
            },
          ],
        },
      },
    });
    expect(poetryFixStub.mock.calls).toHaveLength(2);
    expect(poetryFixStub.mock.calls[0]).toEqual([
      pathLib.resolve(workspacesPath, 'simple'),
      ['six==2.0.1', 'transitive==1.1.1'],
      {},
    ]);
    expect(poetryFixStub.mock.calls[1]).toEqual([
      pathLib.resolve(workspacesPath, 'simple'),
      ['json-api==0.1.22'],
      {
        dev: true,
      },
    ]);
  });
  it('pins a transitive dep with custom python interpreter via --command', async () => {
    jest.spyOn(poetryFix, 'poetryAdd').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      command: 'poetry install',
      duration: 123,
    });
    // Arrange
    const targetFile = 'simple/poetry.lock';

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'markupsafe@2.0.1': {
            upgradeTo: 'markupsafe@2.1.0',
            vulns: ['SNYK-1'],
            isTransitive: true,
          },
        },
      },
    };

    const entityToFix = generateEntityToFixWithFileReadWrite(
      workspacesPath,
      targetFile,
      testResult,
      {
        command: 'python2',
      },
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
                  userMessage: 'Pinned markupsafe from 2.0.1 to 2.1.0',
                },
              ],
            },
          ],
        },
      },
    });
    expect(poetryFixStub.mock.calls).toHaveLength(1);
    expect(poetryFixStub.mock.calls[0]).toEqual([
      pathLib.resolve(workspacesPath, 'simple'),
      ['markupsafe==2.1.0'],
      {
        python: 'python2',
      },
    ]);
  });
  it('shows expected changes when updating a dev dep', async () => {
    jest.spyOn(poetryFix, 'poetryAdd').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      command: 'poetry install',
      duration: 123,
    });
    // Arrange
    const targetFile = 'with-dev-deps/pyproject.toml';

    const testResult = {
      ...generateTestResult(),
      remediation: {
        unresolved: [],
        upgrade: {},
        patch: {},
        ignore: {},
        pin: {
          'json-api@0.1.21': {
            upgradeTo: 'json-api@0.1.22',
            vulns: ['SNYK-1'],
            isTransitive: false,
          },
        },
      },
    };

    const entityToFix = generateEntityToFixWithFileReadWrite(
      workspacesPath,
      targetFile,
      testResult,
      {
        dev: true,
      },
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
                  userMessage: 'Upgraded json-api from 0.1.21 to 0.1.22',
                },
              ],
            },
          ],
        },
      },
    });
    expect(poetryFixStub.mock.calls).toHaveLength(1);
    expect(poetryFixStub.mock.calls[0]).toEqual([
      pathLib.resolve(workspacesPath, 'with-dev-deps'),
      ['json-api==0.1.22'],
      {
        dev: true,
      },
    ]);
  });

  it.todo(
    'upgrade fails since the env already has the right versions (full failure)',
  );

  it.todo('upgrade of dev deps fails (partial failure)');
});
