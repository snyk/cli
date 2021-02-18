import * as snykFix from '../../src';
import { generateEntityToFix } from '../helpers/generate-entity-to-fix';
describe('Snyk fix', () => {
  it('Snyk fix throws error when called with unsupported type', () => {
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
    expect(
      snykFix.fix([projectTestResult]),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      '"Provided scan type is not supported"',
    );
    expect(stdoutMessages).toMatchSnapshot();
    // restore original console.error
    console.log = origConsoleLog;
  });
  it('Snyk fix returns results for supported type', async () => {
    const projectTestResult = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const res = await snykFix.fix([projectTestResult]);
    expect(res).toMatchSnapshot();
  });

  it('Snyk fix returns results for supported & unsupported type', async () => {
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
    const res = await snykFix.fix([
      projectTestResult,
      pipfileProjectTestResult,
    ]);
    expect(res).toMatchSnapshot();
  });

  it('Snyk fix returns results as expected', async () => {
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
    const res = await snykFix.fix([
      txtDevProjectTestResult,
      txtProdProjectTestResult,
      pipfileProjectTestResult,
    ]);
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
    // TODO: only 1 should succeed once implemented the fix
    expect(res.resultsByPlugin.python.succeeded).toHaveLength(2);
    expect(
      res.resultsByPlugin.python.succeeded[0].scanResult.identity.targetFile,
    ).toEqual('dev.txt');
    expect(
      res.resultsByPlugin.python.succeeded[1].scanResult.identity.targetFile,
    ).toEqual('prod.txt');
  });
  it('Snyk fix returns results as expected when 1 fails to fix', async () => {
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
    const res = await snykFix.fix([
      txtDevProjectTestResult,
      txtProdProjectTestResult,
      pipfileProjectTestResult,
    ]);
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
    const res = snykFix.groupEntitiesPerScanType([
      txtProdProjectTestResult,
      txtDevProjectTestResult,
      pipfileProjectTestResult,
    ]);
    expect(Object.keys(res)[0]).toEqual('pip');
    expect(Object.keys(res)[0]).toHaveLength(3);
  });
  it('It correctly groups related entities per handler type (mixed)', () => {
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
    const res = snykFix.groupEntitiesPerScanType([
      txtProdProjectTestResult,
      txtDevProjectTestResult,
      npmProjectTestResult,
    ]);
    expect(Object.keys(res).sort()).toEqual(['npm', 'pip']);
    expect(res.npm).toHaveLength(1);
    expect(res.pip).toHaveLength(2);
  });

  it('It correctly groups related entities per handler type with missing type', () => {
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
    delete missingProjectTestResult.scanResult.identity.type;

    const res = snykFix.groupEntitiesPerScanType([
      txtProdProjectTestResult,
      txtDevProjectTestResult,
      missingProjectTestResult,
    ]);
    expect(Object.keys(res).sort()).toEqual(['missing-type', 'pip']);
    expect(res['missing-type']).toHaveLength(1);
    expect(res.pip).toHaveLength(2);
  });
});
