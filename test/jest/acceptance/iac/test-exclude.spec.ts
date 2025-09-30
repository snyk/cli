import { startMockServer } from './helpers';
import * as pathLib from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as rimraf from 'rimraf';

jest.setTimeout(50000);

describe('IAC test --exclude flag', () => {
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;
  let tmpTestDir: string;

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(() => {
    // Create temporary test directory structure
    tmpTestDir = fs.mkdtempSync(
      pathLib.join(os.tmpdir(), 'test-iac-exclude-'),
    );

    // Create test directory structure with IAC files
    const includedDir = pathLib.join(tmpTestDir, 'included');
    const excludedDir = pathLib.join(tmpTestDir, 'excluded');
    const ignoredDir = pathLib.join(tmpTestDir, 'ignored');

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

  afterEach(() => {
    // Clean up temporary directory
    if (tmpTestDir) {
      rimraf.sync(tmpTestDir);
    }
  });

  it('scans all directories when no exclusions are specified', async () => {
    const { stdout, exitCode } = await run(`snyk iac test ${tmpTestDir}`);

    // All three directories should be scanned
    expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
    expect(stdout).toContainText(pathLib.join('excluded', 'main.tf'));
    expect(stdout).toContainText(pathLib.join('ignored', 'main.tf'));
    expect(exitCode).toBe(1); // Will have issues
  });

  it('excludes a single directory when using --exclude', async () => {
    const excludePath = pathLib.join(tmpTestDir, 'excluded');
    const { stdout, exitCode } = await run(
      `snyk iac test --exclude=${excludePath} ${tmpTestDir}`,
    );

    // Only included and ignored directories should be scanned
    expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
    expect(stdout).toContainText(pathLib.join('ignored', 'main.tf'));
    // Excluded directory should not appear
    expect(stdout).not.toContainText(pathLib.join('excluded', 'main.tf'));
    expect(exitCode).toBe(1); // Will have issues
  });

  it('excludes multiple directories when using comma-separated --exclude', async () => {
    const excludePath = pathLib.join(tmpTestDir, 'excluded');
    const ignoredPath = pathLib.join(tmpTestDir, 'ignored');
    const { stdout, exitCode } = await run(
      `snyk iac test --exclude=${excludePath},${ignoredPath} ${tmpTestDir}`,
    );

    // Only included directory should be scanned
    expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
    // Excluded and ignored directories should not appear
    expect(stdout).not.toContainText(pathLib.join('excluded', 'main.tf'));
    expect(stdout).not.toContainText(pathLib.join('ignored', 'main.tf'));
    expect(exitCode).toBe(1); // Will have issues
  });

  it('excludes specific files when using --exclude with file path', async () => {
    const excludeFile = pathLib.join(tmpTestDir, 'excluded', 'main.tf');
    const { stdout, exitCode } = await run(
      `snyk iac test --exclude=${excludeFile} ${tmpTestDir}`,
    );

    // Included and ignored should be scanned
    expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
    expect(stdout).toContainText(pathLib.join('ignored', 'main.tf'));
    // Excluded file should not appear
    expect(stdout).not.toContainText(pathLib.join('excluded', 'main.tf'));
    expect(exitCode).toBe(1); // Will have issues
  });

  it('works with --exclude and --json flag', async () => {
    const excludePath = pathLib.join(tmpTestDir, 'excluded');
    const { stdout, exitCode } = await run(
      `snyk iac test --exclude=${excludePath} --json ${tmpTestDir}`,
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
    const excludePath = pathLib.join(tmpTestDir, 'excluded');
    const { stdout, exitCode } = await run(
      `snyk iac test --exclude=${excludePath} --sarif ${tmpTestDir}`,
    );

    // Should not contain excluded path in SARIF output
    expect(stdout).not.toContainText(pathLib.join('excluded', 'main.tf'));
    expect(exitCode).toBe(1);
  });

  describe('with nested directory structure', () => {
    let nestedDir: string;

    beforeEach(() => {
      // Create a more complex nested structure
      nestedDir = pathLib.join(tmpTestDir, 'nested');
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
      const excludePath = pathLib.join(tmpTestDir, 'nested', 'excluded');
      const { stdout } = await run(
        `snyk iac test --exclude=${excludePath} ${tmpTestDir}`,
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
      const excludePath = pathLib.join(tmpTestDir, 'nested');
      const { stdout } = await run(
        `snyk iac test --exclude=${excludePath} ${tmpTestDir}`,
      );

      // Should not include any files from nested directory
      expect(stdout).not.toContainText('nested');
      // Should still include top-level directories
      expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
    });
  });

  describe('edge cases', () => {
    it('handles relative paths in --exclude', async () => {
      // Change to tmpTestDir and use relative paths
      const originalCwd = process.cwd();
      process.chdir(tmpTestDir);

      try {
        const { stdout } = await run(`snyk iac test --exclude=excluded .`);

        expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
        expect(stdout).not.toContainText(pathLib.join('excluded', 'main.tf'));
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('handles exclusion of non-existent paths gracefully', async () => {
      const excludePath = pathLib.join(tmpTestDir, 'does-not-exist');
      const { stdout, exitCode } = await run(
        `snyk iac test --exclude=${excludePath} ${tmpTestDir}`,
      );

      // Should scan normally, ignoring the non-existent exclusion
      expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
      expect(exitCode).toBe(1);
    });

    it('handles empty --exclude value', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test --exclude= ${tmpTestDir}`,
      );

      // Should scan all directories when exclude is empty
      expect(stdout).toContainText(pathLib.join('included', 'main.tf'));
      expect(stdout).toContainText(pathLib.join('excluded', 'main.tf'));
      expect(exitCode).toBe(1);
    });
  });
});
