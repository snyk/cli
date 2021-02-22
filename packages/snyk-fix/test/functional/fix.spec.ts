import * as snykFix from '../../src';
import { generateEntityToFix } from '../helpers/generate-entity-to-fix';
describe('Snyk fix', () => {
  it('Snyk fix returns results for supported type', async () => {
    // Arrange
    const projectTestResult = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );

    // Act
    const res = await snykFix.fix([projectTestResult]);

    // Assert
    expect(res).toMatchSnapshot();
  });

  it('Snyk fix returns results for supported & unsupported type', async () => {
    // Arrange
    const projectTestResult = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const pipfileProjectTestResult = generateEntityToFix(
      'pip',
      'Pipfile',
      JSON.stringify({}),
    );

    // Act
    const res = await snykFix.fix([
      projectTestResult,
      pipfileProjectTestResult,
    ]);

    // Assert
    expect(res).toMatchSnapshot();
  });

  it('Snyk fix returns results as expected', async () => {
    // Arrange
    const txtProdProjectTestResult = generateEntityToFix(
      'pip',
      'prod.txt',
      JSON.stringify({}),
    );
    const txtDevProjectTestResult = generateEntityToFix(
      'pip',
      'dev.txt',
      JSON.stringify({}),
    );
    const pipfileProjectTestResult = generateEntityToFix(
      'pip',
      'Pipfile',
      JSON.stringify({}),
    );

    // Act
    const res = await snykFix.fix([
      txtDevProjectTestResult,
      txtProdProjectTestResult,
      pipfileProjectTestResult,
    ]);

    // Assert
    expect(res.exceptionsByScanType).toEqual({});
    expect(Object.keys(res.resultsByPlugin)).toHaveLength(1);
    expect(Object.keys(res.resultsByPlugin)[0]).toEqual('python');
    // skipped unsupported
    expect(res.resultsByPlugin.python.skipped).toHaveLength(1);
    expect(res.resultsByPlugin.python.skipped[0]).toEqual(
      pipfileProjectTestResult,
    );

    // first *.txt throws because of the mock above
    expect(res.resultsByPlugin.python.failed).toHaveLength(0);
    expect(res.resultsByPlugin.python.succeeded).toHaveLength(2);
    expect(
      res.resultsByPlugin.python.succeeded[0].scanResult.identity.targetFile,
    ).toEqual('dev.txt');
    expect(
      res.resultsByPlugin.python.succeeded[1].scanResult.identity.targetFile,
    ).toEqual('prod.txt');
  });
  it('Snyk fix returns results as expected when 1 fails to fix', async () => {
    // Arrange
    const txtProdProjectTestResult = generateEntityToFix(
      'pip',
      'prod.txt',
      JSON.stringify({}),
    );
    const txtDevProjectTestResult = generateEntityToFix(
      'pip',
      'dev.txt',
      JSON.stringify({}),
    );
    jest
      .spyOn(txtDevProjectTestResult.workspace, 'readFile')
      .mockImplementation(() => {
        throw new Error('Invalid encoding');
      });
    const pipfileProjectTestResult = generateEntityToFix(
      'pip',
      'Pipfile',
      JSON.stringify({}),
    );

    // Act
    const res = await snykFix.fix([
      txtDevProjectTestResult,
      txtProdProjectTestResult,
      pipfileProjectTestResult,
    ]);

    // Assert
    expect(res.exceptionsByScanType).toEqual({});
    expect(Object.keys(res.resultsByPlugin)).toHaveLength(1);
    expect(Object.keys(res.resultsByPlugin)[0]).toEqual('python');
    // skipped unsupported
    expect(res.resultsByPlugin.python.skipped).toHaveLength(1);
    expect(res.resultsByPlugin.python.skipped[0]).toEqual(
      pipfileProjectTestResult,
    );

    // first *.txt throws because of the mock above
    expect(res.resultsByPlugin.python.failed).toHaveLength(1);
    expect(
      res.resultsByPlugin.python.failed[0].scanResult.identity.targetFile,
    ).toEqual('dev.txt');

    expect(res.resultsByPlugin.python.succeeded).toHaveLength(1);

    expect(
      res.resultsByPlugin.python.succeeded[0].scanResult.identity.targetFile,
    ).toEqual('prod.txt');
  });
});

describe('groupEntitiesPerScanType', () => {
  it('It correctly groups related entities per handler type (pip)', () => {
    // Arrange
    const txtProdProjectTestResult = generateEntityToFix(
      'pip',
      'prod.txt',
      JSON.stringify({}),
    );
    const txtDevProjectTestResult = generateEntityToFix(
      'pip',
      'dev.txt',
      JSON.stringify({}),
    );
    const pipfileProjectTestResult = generateEntityToFix(
      'pip',
      'Pipfile',
      JSON.stringify({}),
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
      JSON.stringify({}),
    );
    const txtDevProjectTestResult = generateEntityToFix(
      'pip',
      'dev.txt',
      JSON.stringify({}),
    );
    const npmProjectTestResult = generateEntityToFix(
      'npm',
      'package.json',
      JSON.stringify({}),
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
      JSON.stringify({}),
    );
    const txtDevProjectTestResult = generateEntityToFix(
      'pip',
      'dev.txt',
      JSON.stringify({}),
    );
    const missingProjectTestResult = generateEntityToFix(
      'npm',
      'package.json',
      JSON.stringify({}),
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
    // read data from console.error
    let stdoutMessages = '';
    const stubConsoleError = (msg: string) => (stdoutMessages += msg);
    const origConsoleLog = console.error;
    console.error = stubConsoleError;
    const projectTestResult = generateEntityToFix(
      'npm',
      'package.json',
      JSON.stringify({}),
    );
    // Act
    const res = await snykFix.fix([projectTestResult]);
    // Assert
    expect(
      res,
    ).toMatchSnapshot();
    expect(stdoutMessages).toMatchSnapshot();
    // restore original console.error
    console.log = origConsoleLog;
  });
});
