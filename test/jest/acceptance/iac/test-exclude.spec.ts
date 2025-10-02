import { startMockServer } from './helpers';
import * as pathLib from 'path';
import * as fs from 'fs';
import * as rimraf from 'rimraf';

jest.setTimeout(50000);

describe('IAC test --exclude flag', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;
  const testDirName = 'iac-test-exclude';
  let testDirPath: string;

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
    
    // Create test directory in fixtures
    const fixturesPath = pathLib.join(__dirname, '../../../../test/fixtures');
    testDirPath = pathLib.join(fixturesPath, testDirName);
    
    // Clean up if exists from previous run
    if (fs.existsSync(testDirPath)) {
      rimraf.sync(testDirPath);
    }
    
    // Create test directory structure with IAC files
    const includedDir = pathLib.join(testDirPath, 'included');
    const excludedDir = pathLib.join(testDirPath, 'excluded');
    const ignoredDir = pathLib.join(testDirPath, 'ignored');

    fs.mkdirSync(testDirPath);
    fs.mkdirSync(includedDir);
    fs.mkdirSync(excludedDir);
    fs.mkdirSync(ignoredDir);

    // Create terraform files with S3 bucket resources
    fs.writeFileSync(
      pathLib.join(includedDir, 'main.tf'),
      'resource "aws_s3_bucket" "included" {}\n',
    );
    fs.writeFileSync(
      pathLib.join(excludedDir, 'main.tf'),
      'resource "aws_s3_bucket" "excluded" {}\n',
    );
    fs.writeFileSync(
      pathLib.join(ignoredDir, 'main.tf'),
      'resource "aws_s3_bucket" "ignored" {}\n',
    );
  });

  afterAll(async () => {
    // Clean up test directory
    if (testDirPath && fs.existsSync(testDirPath)) {
      rimraf.sync(testDirPath);
    }
    await teardown();
  });

  it('scans all directories when no exclusions are specified', async () => {
    const { stdout, exitCode } = await run(`snyk iac test ./${testDirName}`);

    // All three directories should be scanned
    expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
    expect(stdout).toContainText(pathLib.join('excluded', 'main.tf'));
    expect(stdout).toContainText(pathLib.join('ignored', 'main.tf'));
    expect(exitCode).toBe(1); // Will have issues
  });

  it('excludes a single directory when using --exclude', async () => {
    const excludePath = pathLib.join(testDirName, 'excluded');
    const { stdout, exitCode } = await run(
      `snyk iac test --exclude=${excludePath} ./${testDirName}`,
    );

    // Only included and ignored directories should be scanned
    expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
    expect(stdout).toContainText(pathLib.join('ignored', 'main.tf'));
    // Excluded directory should not appear
    expect(stdout).not.toContainText(pathLib.join('excluded', 'main.tf'));
    expect(exitCode).toBe(1); // Will have issues
  });

  it('excludes multiple directories when using comma-separated --exclude', async () => {
    const excludePath = pathLib.join(testDirName, 'excluded');
    const ignoredPath = pathLib.join(testDirName, 'ignored');
    const { stdout, exitCode } = await run(
      `snyk iac test --exclude=${excludePath},${ignoredPath} ./${testDirName}`,
    );

    // Only included directory should be scanned
    expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
    // Excluded and ignored directories should not appear
    expect(stdout).not.toContainText(pathLib.join('excluded', 'main.tf'));
    expect(stdout).not.toContainText(pathLib.join('ignored', 'main.tf'));
    expect(exitCode).toBe(1); // Will have issues
  });

  it('excludes specific files when using --exclude with file path', async () => {
    const excludeFile = pathLib.join(testDirName, 'excluded', 'main.tf');
    const { stdout, exitCode } = await run(
      `snyk iac test --exclude=${excludeFile} ./${testDirName}`,
    );

    // Included and ignored should be scanned
    expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
    expect(stdout).toContainText(pathLib.join('ignored', 'main.tf'));
    // Excluded file should not appear
    expect(stdout).not.toContainText(pathLib.join('excluded', 'main.tf'));
    expect(exitCode).toBe(1); // Will have issues
  });

  it('works with --exclude and --json flag', async () => {
    const excludePath = pathLib.join(testDirName, 'excluded');
    const { stdout, exitCode } = await run(
      `snyk iac test --exclude=${excludePath} --json ./${testDirName}`,
    );

    // Parse the JSON output
    const jsonOutput = JSON.parse(stdout);

    // Should have results for included and ignored, but not excluded
    const allPaths = jsonOutput.map((result) => result.targetFile || '');
    const hasIncluded = allPaths.some((p) => p.includes('included'));
    const hasIgnored = allPaths.some((p) => p.includes('ignored'));
    const hasExcluded = allPaths.some((p) => p.includes('excluded'));

    expect(hasIncluded).toBe(true);
    expect(hasIgnored).toBe(true);
    expect(hasExcluded).toBe(false);
    expect(exitCode).toBe(1);
  });

  it('works with --exclude and --sarif flag', async () => {
    const excludePath = pathLib.join(testDirName, 'excluded');
    const { stdout, exitCode } = await run(
      `snyk iac test --exclude=${excludePath} --sarif ./${testDirName}`,
    );

    // Should not contain excluded path in SARIF output
    expect(stdout).not.toContainText(pathLib.join('excluded', 'main.tf'));
    expect(exitCode).toBe(1);
  });

  describe('with nested directory structure', () => {
    beforeAll(() => {
      // Create a more complex nested structure
      const nestedDir = pathLib.join(testDirPath, 'nested');
      const nestedExcluded = pathLib.join(nestedDir, 'excluded');
      const nestedIncluded = pathLib.join(nestedDir, 'included');

      fs.mkdirSync(nestedDir);
      fs.mkdirSync(nestedExcluded);
      fs.mkdirSync(nestedIncluded);

      fs.writeFileSync(
        pathLib.join(nestedExcluded, 'nested.tf'),
        'resource "aws_s3_bucket" "nested_excluded" {}\n',
      );
      fs.writeFileSync(
        pathLib.join(nestedIncluded, 'nested.tf'),
        'resource "aws_s3_bucket" "nested_included" {}\n',
      );
    });

    it('excludes nested directories correctly', async () => {
      const excludePath = pathLib.join(testDirName, 'nested', 'excluded');
      const { stdout } = await run(
        `snyk iac test --exclude=${excludePath} ./${testDirName}`,
      );

      // Should include the nested/included directory
      expect(stdout).toContainText(
        pathLib.join('nested', 'included', 'nested.tf'),
      );
      // Should not include the nested/excluded directory
      expect(stdout).not.toContainText(
        pathLib.join('nested', 'excluded', 'nested.tf'),
      );
    });

    it('excludes entire parent directory when parent is excluded', async () => {
      const excludePath = pathLib.join(testDirName, 'nested');
      const { stdout } = await run(
        `snyk iac test --exclude=${excludePath} ./${testDirName}`,
      );

      // Should not include any files from nested directory
      expect(stdout).not.toContainText(
        pathLib.join(testDirName, 'nested'),
      );
      // Should still include top-level directories
      expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
    });
  });

  describe('edge cases', () => {
    it('handles exclusion of non-existent paths gracefully', async () => {
      const excludePath = pathLib.join(testDirName, 'does-not-exist');
      const { stdout, exitCode } = await run(
        `snyk iac test --exclude=${excludePath} ./${testDirName}`,
      );

      // Should scan normally, ignoring the non-existent exclusion
      expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
      expect(exitCode).toBe(1);
    });

    it('handles empty --exclude value', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test --exclude= ./${testDirName}`,
      );

      // Should scan all directories when exclude is empty
      expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
      expect(stdout).toContainText(pathLib.join('excluded', 'main.tf'));
      expect(exitCode).toBe(1);
    });
  });
});
