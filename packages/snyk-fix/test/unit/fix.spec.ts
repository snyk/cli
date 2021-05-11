import * as pipenvPipfileFix from '@snyk/fix-pipenv-pipfile';

import * as snykFix from '../../src';
import { generateEntityToFix } from '../helpers/generate-entity-to-fix';

jest.mock('@snyk/fix-pipenv-pipfile');

describe('Snyk fix', () => {
  beforeAll(() => {
    jest.spyOn(pipenvPipfileFix, 'isPipenvSupportedVersion').mockReturnValue({
      supported: true,
      versions: ['123.123.123'],
    });
    jest.spyOn(pipenvPipfileFix, 'isPipenvInstalled').mockResolvedValue({
      version: '123.123.123',
    });
    jest.spyOn(pipenvPipfileFix, 'pipenvInstall').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      command: 'pipenv install',
      duration: 123,
    });
  });

  it('Snyk fix returns results for supported type', async () => {
    // Arrange
    const projectTestResult = generateEntityToFix(
      'pip',
      'requirements.txt',
      'django===1.6.1',
    );
    const writeFileSpy = jest.spyOn(projectTestResult.workspace, 'writeFile');

    // Act
    const res = await snykFix.fix([projectTestResult], {
      quiet: true,
      stripAnsi: true,
    });

    // Assert
    expect(writeFileSpy).toHaveBeenCalledTimes(1);
    expect(res.exceptions).toMatchSnapshot();
    expect(res.results).toMatchSnapshot();
  });

  it('Snyk fix returns results for supported type in dryRun mode (no write)', async () => {
    // Arrange
    const projectTestResult = generateEntityToFix(
      'pip',
      'requirements.txt',
      'django===1.6.1',
    );
    const writeFileSpy = jest.spyOn(projectTestResult.workspace, 'writeFile');
    // Act
    await snykFix.fix([projectTestResult], {
      quiet: true,
      dryRun: true,
    });

    // Assert
    expect(writeFileSpy).not.toHaveBeenCalled();
  });

  it('Snyk fix returns results for supported & unsupported type', async () => {
    // Arrange
    const projectTestResult = generateEntityToFix(
      'pip',
      'requirements.txt',
      'django===1.6.1',
    );
    const pipfileProjectTestResult = generateEntityToFix('pip', 'Pipfile', '');

    // Act
    const res = await snykFix.fix(
      [projectTestResult, pipfileProjectTestResult],
      { quiet: true, stripAnsi: true, dryRun: true },
    );

    // Assert
    expect(res).toMatchSnapshot();
  });

  it('Snyk fix returns results as expected', async () => {
    // Arrange
    const txtProdProjectTestResult = generateEntityToFix(
      'pip',
      'prod.txt',
      'django===1.6.1',
    );
    const txtDevProjectTestResult = generateEntityToFix(
      'pip',
      'dev.txt',
      'django===1.6.1',
    );
    const pipfileProjectTestResult = generateEntityToFix('pip', 'Pipfile', '');

    // Act
    const res = await snykFix.fix(
      [
        txtDevProjectTestResult,
        txtProdProjectTestResult,
        pipfileProjectTestResult,
      ],
      { quiet: true, stripAnsi: true, dryRun: true },
    );

    // Assert
    expect(res.exceptions).toEqual({});
    expect(Object.keys(res.results)).toHaveLength(1);
    expect(Object.keys(res.results)[0]).toEqual('python');
    // skipped unsupported
    expect(res.results.python.skipped).toHaveLength(0);

    // first *.txt throws because of the mock above
    expect(res.results.python.failed).toHaveLength(0);
    expect(res.results.python.succeeded).toHaveLength(3);
    expect(
      res.results.python.succeeded[0].original.scanResult.identity.targetFile,
    ).toEqual('Pipfile');
    expect(
      res.results.python.succeeded[1].original.scanResult.identity.targetFile,
    ).toEqual('dev.txt');
    expect(
      res.results.python.succeeded[2].original.scanResult.identity.targetFile,
    ).toEqual('prod.txt');
  });
  it('Snyk fix returns results as expected when 1 fails to fix', async () => {
    // Arrange
    const txtProdProjectTestResult = generateEntityToFix(
      'pip',
      'prod.txt',
      'django===1.6.1',
    );
    const txtDevProjectTestResult = generateEntityToFix(
      'pip',
      'dev.txt',
      'django===1.6.1',
    );
    jest
      .spyOn(txtDevProjectTestResult.workspace, 'readFile')
      .mockImplementation(() => {
        throw new Error('Test Error: Invalid encoding');
      });
    const pipfileProjectTestResult = generateEntityToFix('pip', 'Pipfile', '');

    // Act
    const res = await snykFix.fix(
      [
        txtDevProjectTestResult,
        txtProdProjectTestResult,
        pipfileProjectTestResult,
      ],
      { quiet: true, stripAnsi: true, dryRun: true },
    );

    // Assert
    expect(res.exceptions).toEqual({});
    expect(Object.keys(res.results)).toHaveLength(1);
    expect(Object.keys(res.results)[0]).toEqual('python');

    expect(res.results.python.skipped).toHaveLength(0);

    expect(res.results.python.failed[0]).toEqual({
      error: new Error('Test Error: Invalid encoding'),
      original: txtDevProjectTestResult,
    });

    expect(res.results.python.failed).toHaveLength(1);
    expect(res.results.python.succeeded).toHaveLength(2);

    expect(
      res.results.python.succeeded[0].original.scanResult.identity.targetFile,
    ).toEqual('Pipfile');
    expect(
      res.results.python.succeeded[1].original.scanResult.identity.targetFile,
    ).toEqual('prod.txt');
  });

  it('Snyk fix returns results as expected when remediation data is empty', async () => {
    // Arrange
    const txtProdProjectTestResult = generateEntityToFix(
      'pip',
      'prod.txt',
      'django===1.6.1',
    );
    // @ts-ignore: The operand of a 'delete' operator must be optional
    delete txtProdProjectTestResult.testResult.remediation;

    // Act
    const res = await snykFix.fix([txtProdProjectTestResult], {
      quiet: true,
      stripAnsi: true,
    });
    // Assert
    expect(res.exceptions).toEqual({});
    expect(Object.keys(res.results)).toHaveLength(1);
    expect(Object.keys(res.results)[0]).toEqual('python');

    // first *.txt throws because remediation is empty
    expect(res.results.python.failed).toHaveLength(0);
    expect(res.results.python.skipped).toHaveLength(1);
    expect(
      res.results.python.skipped[0].original.scanResult.identity.targetFile,
    ).toEqual('prod.txt');
    expect(res.results.python.skipped[0].userMessage).toEqual(
      'No remediation data available',
    );
  });
});

describe('groupEntitiesPerScanType', () => {
  it('It correctly groups related entities per handler type (pip)', () => {
    // Arrange
    const txtProdProjectTestResult = generateEntityToFix(
      'pip',
      'prod.txt',
      'django===1.6.1',
    );
    const txtDevProjectTestResult = generateEntityToFix(
      'pip',
      'dev.txt',
      'django===1.6.1',
    );
    const pipfileProjectTestResult = generateEntityToFix(
      'pip',
      'Pipfile',
      'django===1.6.1',
    );

    // Act
    const res = snykFix.groupEntitiesPerScanType([
      txtProdProjectTestResult,
      txtDevProjectTestResult,
      pipfileProjectTestResult,
    ]);

    // Assert
    expect(Object.keys(res)[0]).toEqual('pip');
    expect(Object.keys(res)[0]).toHaveLength(3);
  });
  it('It correctly groups related entities per handler type (mixed)', () => {
    // Arrange
    const txtProdProjectTestResult = generateEntityToFix(
      'pip',
      'prod.txt',
      'django===1.6.1',
    );
    const txtDevProjectTestResult = generateEntityToFix(
      'pip',
      'dev.txt',
      'django===1.6.1',
    );
    const npmProjectTestResult = generateEntityToFix(
      'npm',
      'package.json',
      'django===1.6.1',
    );

    // Act
    const res = snykFix.groupEntitiesPerScanType([
      txtProdProjectTestResult,
      txtDevProjectTestResult,
      npmProjectTestResult,
    ]);

    // Assert
    expect(Object.keys(res).sort()).toEqual(['npm', 'pip']);
    expect(res.npm).toHaveLength(1);
    expect(res.pip).toHaveLength(2);
  });

  it('It correctly groups related entities per handler type with missing type', () => {
    // Arrange
    const txtProdProjectTestResult = generateEntityToFix(
      'pip',
      'prod.txt',
      'django===1.6.1',
    );
    const txtDevProjectTestResult = generateEntityToFix(
      'pip',
      'dev.txt',
      'django===1.6.1',
    );
    const missingProjectTestResult = generateEntityToFix(
      'npm',
      'package.json',
      'django===1.6.1',
    );
    // @ts-ignore: The operand of a 'delete' operator must be optional
    delete missingProjectTestResult.scanResult.identity.type;

    // Act
    const res = snykFix.groupEntitiesPerScanType([
      txtProdProjectTestResult,
      txtDevProjectTestResult,
      missingProjectTestResult,
    ]);

    // Assert
    expect(Object.keys(res).sort()).toEqual(['missing-type', 'pip']);
    expect(res['missing-type']).toHaveLength(1);
    expect(res.pip).toHaveLength(2);
  });
});

describe('Error handling', () => {
  it('Snyk fix returns error when called with unsupported type', async () => {
    // Arrange
    const projectTestResult = generateEntityToFix(
      'npm',
      'package.json',
      JSON.stringify({}),
    );
    // Act
    const res = await snykFix.fix([projectTestResult], {
      quiet: true,
      stripAnsi: true,
    });
    // Assert
    expect(res).toMatchSnapshot();
  });

  it('Snyk fix returns error when manifest can not be parsed', async () => {
    // Arrange
    const projectTestResult = generateEntityToFix(
      'pip',
      'requirements.txt',
      'django@===1.6.1', // invalid requirements
    );
    // Act
    const res = await snykFix.fix([projectTestResult], {
      quiet: true,
      stripAnsi: true,
    });
    // Assert
    expect(res).toMatchSnapshot();
  });
});
