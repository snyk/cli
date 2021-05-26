import { readFileSync, unlinkSync } from 'fs';
import * as path from 'path';
import * as sarif from 'sarif';
import { v4 as uuidv4 } from 'uuid';
import { startMockServer } from './helpers';
import { MappedIacTestResponse } from '../../../../src/lib/snyk-test/iac-test-result';
jest.setTimeout(50000);

describe('iac test --json-file-output', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
  });

  afterAll(async () => teardown());

  it('can save JSON output to file while sending human readable output to stdout', async () => {
    const jsonOutputFilename = path.join(__dirname, `${uuidv4()}.json`);
    const { stdout } = await run(
      `snyk iac test ./iac/terraform/sg_open_ssh.tf --json-file-output=${jsonOutputFilename}`,
    );
    expect(stdout).toMatch('Organization:');

    const outputFileContents = readFileSync(jsonOutputFilename, 'utf-8');
    unlinkSync(jsonOutputFilename);
    const jsonObj: MappedIacTestResponse = JSON.parse(outputFileContents);
    const lineNumber = jsonObj?.infrastructureAsCodeIssues?.[0].lineNumber;
    expect(lineNumber).not.toBeUndefined();
    expect(lineNumber).not.toEqual(-1);
  });
});

describe('iac test --sarif-file-output', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
  });

  afterAll(async () => teardown());

  it('can save Sarif output to file while sending human readable output to stdout', async () => {
    const sarifOutputFilename = path.join(__dirname, `${uuidv4()}.sarif`);
    const { stdout } = await run(
      `snyk iac test ./iac/terraform/sg_open_ssh.tf --sarif-file-output=${sarifOutputFilename}`,
    );
    expect(stdout).toMatch('Organization:');

    const outputFileContents = readFileSync(sarifOutputFilename, 'utf-8');
    unlinkSync(sarifOutputFilename);
    const jsonObj: sarif.Log = JSON.parse(outputFileContents);
    const startLine =
      jsonObj?.runs?.[0].results?.[0].locations?.[0].physicalLocation?.region
        ?.startLine;
    expect(startLine).not.toBeUndefined();
    expect(startLine).not.toEqual(-1);
  });
});
