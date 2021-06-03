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

  [
    {
      location: './iac/file-output/sg_open_ssh.tf', // single file
      expectedTargetFilePath: path.resolve(
        './test/fixtures/iac/file-output/sg_open_ssh.tf',
      ),
      expectedTargetFile: './iac/file-output/sg_open_ssh.tf',
      expectedProjectName: 'file-output',
    },
    {
      location: './iac/file-output/nested-folder', // folder with a single file
      expectedTargetFilePath: path.resolve(
        './test/fixtures/iac/file-output/nested-folder/sg_open_ssh.tf',
      ),
      expectedTargetFile: 'sg_open_ssh.tf',
      expectedProjectName: 'nested-folder',
    },
    {
      location: './iac/file-output', // folder with a nested folder
      expectedTargetFilePath: path.resolve(
        './test/fixtures/iac/file-output/nested-folder/sg_open_ssh.tf',
      ),
      expectedTargetFile: path.join(
        'nested-folder',
        path.sep,
        'sg_open_ssh.tf',
      ),
      expectedProjectName: 'file-output',
      isNested: true,
    },
    {
      location: '../fixtures/iac/file-output/nested-folder', // folder nested outside running directory
      expectedTargetFilePath: path.resolve(
        './test/fixtures/iac/file-output/nested-folder/sg_open_ssh.tf',
      ),
      expectedTargetFile: 'sg_open_ssh.tf',
      expectedProjectName: 'nested-folder',
    },
  ].forEach(
    ({
      location,
      expectedTargetFilePath,
      expectedTargetFile,
      expectedProjectName,
      isNested,
    }) => {
      it(`returns the correct paths for provided path ${location}`, async () => {
        const jsonOutputFilename = path.join(__dirname, `${uuidv4()}.json`);
        const { stdout } = await run(
          `snyk iac test ${location} --json-file-output=${jsonOutputFilename}`,
        );
        expect(stdout).toMatch('Organization:');

        const outputFileContents = readFileSync(jsonOutputFilename, 'utf-8');
        unlinkSync(jsonOutputFilename);
        let jsonObj = JSON.parse(outputFileContents);
        if (isNested) {
          jsonObj = jsonObj[0];
        }
        const actualTargetFilePath = jsonObj?.targetFilePath;
        const actualTargetFile = jsonObj?.targetFile;
        const actualProjectName = jsonObj?.projectName;
        expect(actualTargetFilePath).toEqual(expectedTargetFilePath);
        expect(actualTargetFile).toEqual(expectedTargetFile);
        expect(actualProjectName).toEqual(expectedProjectName);
      });
    },
  );
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

  [
    {
      location: './iac/file-output/sg_open_ssh.tf', // single file
      expectedPhysicalLocation: path.join('iac/file-output/sg_open_ssh.tf'),
      expectedProjectRoot:
        'file://' + path.join(path.resolve('./test/fixtures/'), '/'),
    },
    {
      location: './iac/file-output/nested-folder', // folder with a single file
      expectedPhysicalLocation: path.join(
        'iac/file-output/nested-folder/sg_open_ssh.tf',
      ),
      expectedProjectRoot:
        'file://' + path.join(path.resolve('./test/fixtures/'), '/'),
    },
    {
      location: './iac/file-output', // folder with a nested folder
      expectedPhysicalLocation: path.join(
        'iac/file-output/nested-folder/sg_open_ssh.tf',
      ),
      expectedProjectRoot:
        'file://' + path.join(path.resolve('./test/fixtures/'), '/'),
    },
    {
      location: '../fixtures/iac/file-output/nested-folder', // folder nested outside running directory
      expectedPhysicalLocation: path.join(
        '../fixtures/iac/file-output/nested-folder/sg_open_ssh.tf',
      ),
      expectedProjectRoot:
        'file://' + path.join(path.resolve('./test/fixtures/'), '/'),
    },
  ].forEach(({ location, expectedPhysicalLocation, expectedProjectRoot }) => {
    it(`returns the correct paths for provided path ${location}`, async () => {
      const sarifOutputFilename = path.join(__dirname, `${uuidv4()}.sarif`);
      const { stdout } = await run(
        `snyk iac test ${location} --sarif-file-output=${sarifOutputFilename}`,
      );
      expect(stdout).toMatch('Organization:');

      const outputFileContents = readFileSync(sarifOutputFilename, 'utf-8');
      unlinkSync(sarifOutputFilename);
      const jsonObj = JSON.parse(outputFileContents);
      const actualProjectRoot =
        jsonObj?.runs?.[0].originalUriBaseIds.PROJECTROOT.uri;
      const actualPhyisicalLocation =
        jsonObj?.runs?.[0].results[0].locations[0].physicalLocation
          .artifactLocation.uri;
      expect(actualProjectRoot).toEqual(expectedProjectRoot);
      expect(actualPhyisicalLocation).toEqual(expectedPhysicalLocation);
    });
  });
});
