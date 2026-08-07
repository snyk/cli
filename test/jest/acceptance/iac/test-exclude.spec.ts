import { startMockServer } from './helpers';
import * as pathLib from 'path';
import * as fs from 'fs';
import * as rimraf from 'rimraf';

jest.setTimeout(50000);

describe('IAC test --exclude flag (Basename Matching)', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;
  const testDirName = 'iac-test-exclude';
  let testDirPath: string;

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
    const fixturesPath = pathLib.join(__dirname, '../../../../test/fixtures');
    testDirPath = pathLib.join(fixturesPath, testDirName);

    if (fs.existsSync(testDirPath)) {
      rimraf.sync(testDirPath);
    }

    const includedDir = pathLib.join(testDirPath, 'included');
    const excludedDir = pathLib.join(testDirPath, 'excluded');
    const nestedExcludedDir = pathLib.join(testDirPath, 'nested', 'excluded');

    fs.mkdirSync(testDirPath, { recursive: true });
    fs.mkdirSync(includedDir, { recursive: true });
    fs.mkdirSync(excludedDir, { recursive: true });
    fs.mkdirSync(nestedExcludedDir, { recursive: true });

    fs.writeFileSync(
      pathLib.join(includedDir, 'main.tf'),
      'resource "aws_s3_bucket" "i" {}\n',
    );
    fs.writeFileSync(
      pathLib.join(excludedDir, 'main.tf'),
      'resource "aws_s3_bucket" "e" {}\n',
    );
    fs.writeFileSync(
      pathLib.join(nestedExcludedDir, 'nested.tf'),
      'resource "aws_s3_bucket" "ne" {}\n',
    );
  });

  afterAll(async () => {
    if (testDirPath && fs.existsSync(testDirPath)) {
      rimraf.sync(testDirPath);
    }
    await teardown();
  });

  it('excludes directories globally by basename', async () => {
    const { stdout, exitCode } = await run(
      `snyk iac test --exclude=excluded ./${testDirName}`,
    );

    expect(stdout).toContainText(pathLib.join('included', 'main.tf'));

    // Both instances of 'excluded' folder should be pruned
    expect(stdout).not.toContainText(pathLib.join('excluded', 'main.tf'));
    expect(stdout).not.toContainText(
      pathLib.join('nested', 'excluded', 'nested.tf'),
    );
    expect(exitCode).toBe(1);
  });

  it('excludes a specific file basename globally', async () => {
    const { stdout } = await run(
      `snyk iac test --exclude=nested.tf ./${testDirName}`,
    );

    expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
    expect(stdout).not.toContainText('nested.tf');
  });

  it('handles multiple basenames in a comma-separated list', async () => {
    const { stdout } = await run(
      `snyk iac test --exclude=included,main.tf ./${testDirName}`,
    );

    expect(stdout).not.toContainText('main.tf');
    expect(stdout).toContainText('nested.tf');
  });
});
