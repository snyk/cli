import { readFileSync, unlinkSync } from 'fs';
import * as path from 'path';
import * as sarif from 'sarif';
import { v4 as uuidv4 } from 'uuid';
import { pathToFileURL } from 'url';

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

  it('contains a valid line number', async () => {
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

  it('returns the correct paths for provided path', async () => {
    const jsonOutputFilename = path.join(__dirname, `${uuidv4()}.json`);
    const { stdout } = await run(
      `snyk iac test ./iac/file-output/sg_open_ssh.tf --json-file-output=${jsonOutputFilename}`,
    );
    expect(stdout).toMatch('Organization:');

    const outputFileContents = readFileSync(jsonOutputFilename, 'utf-8');
    unlinkSync(jsonOutputFilename);
    const jsonObj = JSON.parse(outputFileContents);
    const actualTargetFilePath = jsonObj?.targetFilePath;
    const actualTargetFile = jsonObj?.targetFile;
    const actualProjectName = jsonObj?.projectName;
    expect(actualTargetFilePath).toEqual(
      path.resolve('./test/fixtures/iac/file-output/sg_open_ssh.tf'),
    );
    expect(actualTargetFile).toEqual('./iac/file-output/sg_open_ssh.tf');
    expect(actualProjectName).toEqual('fixtures');
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

  it('contains a valid line number', async () => {
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

  it('returns the correct paths for provided path', async () => {
    const sarifOutputFilename = path.join(__dirname, `${uuidv4()}.sarif`);
    const { stdout } = await run(
      `snyk iac test ./iac/file-output/sg_open_ssh.tf --sarif-file-output=${sarifOutputFilename}`,
    );
    expect(stdout).toMatch('Organization:');

    const outputFileContents = readFileSync(sarifOutputFilename, 'utf-8');
    unlinkSync(sarifOutputFilename);
    const jsonObj = JSON.parse(outputFileContents);
    const actualPhysicalLocation =
      jsonObj?.runs?.[0].results[0].locations[0].physicalLocation
        .artifactLocation.uri;
    const actualProjectRoot =
      jsonObj?.runs?.[0].originalUriBaseIds.PROJECTROOT.uri;
    expect(actualPhysicalLocation).toEqual(
      `${process.cwd()}/file-output/sg_open_ssh.tf`,
    );
    expect(actualProjectRoot).toEqual(
      pathToFileURL(path.join(path.resolve(''), '/')).href,
    );
  });

  it('does not include file content in analytics logs', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test ./iac/file-logging -d`,
    );
    expect(stdout).not.toContain('PRIVATE_FILE_CONTENT_CHECK');
    expect(exitCode).toBe(1);
  });
});
