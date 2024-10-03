import * as os from 'os';
import * as path from 'path';
import { resolve } from 'path';

import { runSnykCLI } from '../util/runSnykCLI';
import { matchers } from 'jest-json-schema';
import * as fs from 'fs';

const projectRoot = resolve(__dirname, '../../..');

expect.extend(matchers);

// For golang implementation only
describe('conditionally write data to disk', () => {
  const projectWithCodeIssues = resolve(
    projectRoot,
    'test/fixtures/sast/with_code_issues',
  );

  const env = {
    // Use an org with consistent ignores enabled - uses golang/native workflow
    SNYK_API: process.env.TEST_SNYK_API_DEV,
    SNYK_TOKEN: process.env.TEST_SNYK_TOKEN_DEV,
    SNYK_LOG_LEVEL: 'trace',
    INTERNAL_CLEANUP_GLOBAL_TEMP_DIR_ENABLED: 'false', // disable cleanup of temp dir for testing
  };

  jest.setTimeout(60000);

  // GAF automatically creates the temp dir
  // GAF will also automatically deletes it
  // but we disable this for testing
  const tempDirName = `tempDir-${Date.now()}`;
  const tempDirPath = path.join(os.tmpdir(), tempDirName);

  afterEach(async () => {
    // delete tempDirPath
    try {
      await fs.promises.rm(tempDirPath, { recursive: true, force: true });
    } catch {
      console.warn('teardown failed');
    }
  });

  describe('when temp dir and threshold are set', () => {
    const tempDirVars = {
      SNYK_TMP_PATH: tempDirPath,
      INTERNAL_IN_MEMORY_THRESHOLD_BYTES: '1',
    };

    it('should write to temp dir if payload is bigger than threshold', async () => {
      await runSnykCLI(`code test ${projectWithCodeIssues}`, {
        env: {
          ...process.env,
          ...env,
          ...tempDirVars,
        },
      });

      // assert that tempDirPath exists
      await expect(
        fs.promises.access(tempDirPath, fs.constants.F_OK),
      ).resolves.toBeUndefined();

      // assert that tempDirPath contains workflow files
      const files = await fs.promises.readdir(tempDirPath);
      const workflowFiles = files.filter((file) => file.includes('workflow.'));
      expect(workflowFiles.length).toBeGreaterThan(0);
    });
  });

  describe('when only threshold is set', () => {
    const tempDirVars = {
      INTERNAL_IN_MEMORY_THRESHOLD_BYTES: '1',
      INTERNAL_CLEANUP_GLOBAL_TEMP_DIR_ENABLED: 'true', // re-enable as we're not setting the temp dir, and we want to ensure we cleanup
    };

    it('should write to default temp dir if payload is bigger than threshold', async () => {
      await runSnykCLI(`code test ${projectWithCodeIssues}`, {
        env: {
          ...process.env,
          ...env,
          ...tempDirVars,
        },
      });

      // note we can't determine whether we write to disk or memory without inspecting logs
      // GAF uses the default OS cache dir to write to, which we cannot access in the test

      // assert that tempDirPath does not exist
      await expect(
        fs.promises.access(tempDirPath, fs.constants.F_OK),
      ).rejects.toThrow();
    });
  });

  describe('when temp dir and threshold are NOT set', () => {
    const tempDirVars = {
      INTERNAL_CLEANUP_GLOBAL_TEMP_DIR_ENABLED: 'true', // re-enable as we're not setting the temp dir, and we want to ensure we cleanup
    };

    it('should use 512MB as default threshold', async () => {
      await runSnykCLI(`code test ${projectWithCodeIssues}`, {
        env: {
          ...process.env,
          ...env,
          ...tempDirVars,
        },
      });

      // note we can't determine whether we write to disk or memory without inspecting logs
      // GAF uses the default OS cache dir to write to, which we cannot access in the test

      // assert that tempDirPath does not exist
      await expect(
        fs.promises.access(tempDirPath, fs.constants.F_OK),
      ).rejects.toThrow();
    });
  });

  describe('when feature is disabled', () => {
    const tempDirVars = {
      INTERNAL_IN_MEMORY_THRESHOLD_BYTES: '-1',
      INTERNAL_CLEANUP_GLOBAL_TEMP_DIR_ENABLED: 'true', // re-enable as we're not setting the temp dir, and we want to ensure we cleanup
    };

    it('should keep payload memory', async () => {
      await runSnykCLI(`code test ${projectWithCodeIssues}`, {
        env: {
          ...process.env,
          ...env,
          ...tempDirVars,
        },
      });

      // assert that tempDirPath does not exist
      await expect(
        fs.promises.access(tempDirPath, fs.constants.F_OK),
      ).rejects.toThrow();
    });
  });
});
