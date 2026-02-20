import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';

import { matchers } from 'jest-json-schema';
import { runSnykCLI } from '../../util/runSnykCLI';
import { EXIT_CODES } from '../../../../src/cli/exit-codes';
import { resolve } from 'path';

expect.extend(matchers);
jest.setTimeout(1000 * 180);

const projectRoot = resolve(__dirname, '../../../..');

const TEST_REPO_COMMIT = '366ae0080cc67973619584080fc85734ba2658b2';
const TEST_REPO_URL = 'https://github.com/leaktk/fake-leaks';
const TEST_DIR = 'examples';
const TEST_FILE = 'some/long/path/server.key';
const TEMP_LOCAL_PATH = '/tmp/snyk-secrets-test';

const env = {
  ...process.env,
  INTERNAL_SNYK_FEATURE_FLAG_IS_SECRETS_ENABLED: 'true',
  SNYK_API: process.env.TEST_SNYK_API_DEV,
  SNYK_TOKEN: process.env.TEST_SNYK_TOKEN_DEV,
};

beforeAll(() => {
  if (!existsSync(TEMP_LOCAL_PATH)) {
    try {
      // Currently fake-leaks doesn't have any release tags, so we pin it to a commit instead
      // and that's why we're cloning the full repo without --depth 1, which may slow down the tests
      execSync(
        `git clone ${TEST_REPO_URL} ${TEMP_LOCAL_PATH} && cd ${TEMP_LOCAL_PATH} && git checkout ${TEST_REPO_COMMIT}`,
        {
          stdio: 'pipe',
          timeout: 30000,
        },
      );
    } catch (error) {
      throw new Error(
        `Failed to clone test repository: ${error.message}. This test requires network access.`,
      );
    }
  }
});

afterAll(() => {
  if (existsSync(TEMP_LOCAL_PATH)) {
    try {
      execSync(`rm -rf ${TEMP_LOCAL_PATH}`, { stdio: 'pipe' });
    } catch (err) {
      console.warn('Failed to cleanup test repository:', err.message);
    }
  }
});

describe.skip('snyk secrets test', () => {
  describe('output formats', () => {
    it('should display human-readable output by default', async () => {
      const { code, stderr } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR}`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
    });

    it('should display sarif output with --sarif', async () => {
      const { code, stderr } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR} --sarif`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
    });

    it('should write sarif to output file with --sarif-file-output', async () => {
      const outputFile = 'test-sarif.json';
      const outputFilePath = `${projectRoot}/${outputFile}`;

      const { code, stderr } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR} --sarif-file-output=${outputFile}`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
      expect(existsSync(outputFilePath)).toBe(true);
      unlinkSync(outputFilePath);
    });
  });

  describe('input paths', () => {
    it('rejects multiple input paths', async () => {
      const { code, stdout } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/foo/libexec ${TEMP_LOCAL_PATH}/foo/testdata`,
        { env },
      );

      expect(stdout).toContain('Only one input path is accepted');
      expect(code).toBe(EXIT_CODES.ERROR);
    });

    it('scans the current working directory', async () => {
      const { code, stderr } = await runSnykCLI(`secrets test`, {
        env,
        cwd: `${TEMP_LOCAL_PATH}/${TEST_DIR}`,
      });

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
    });

    it('scans a single file', async () => {
      const { code, stderr } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR}/${TEST_FILE}`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
    });

    it('scans a directory', async () => {
      const { code, stderr } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR}`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
    });

    it('scans a file from a different subtree', async () => {
      const { code, stderr } = await runSnykCLI(
        `secrets test ../${TEST_DIR}/${TEST_FILE}`,
        {
          env,
          cwd: `${TEMP_LOCAL_PATH}/foo`,
        },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
    });

    it('scans a directory from a different subtree', async () => {
      const { code, stderr } = await runSnykCLI(`secrets test ../${TEST_DIR}`, {
        env,
        cwd: `${TEMP_LOCAL_PATH}/foo`,
      });

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
    });
  });

  describe('validation', () => {
    it('should return an error for --report', async () => {
      const { code, stdout } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR} --report`,
        { env },
      );

      expect(stdout).toContain('Feature under development');
      expect(code).toBe(EXIT_CODES.ERROR);
    });

    const flagsRequiringReport = [
      '--target-reference=main',
      '--target-name=my-project',
      '--project-environment=frontend',
      '--project-lifecycle=production',
      '--project-business-criticality=high',
      '--project-tags=key=value',
    ];

    it.each(flagsRequiringReport)(
      'flag %s requires --report flag',
      async (flag) => {
        const { code, stdout } = await runSnykCLI(
          `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR} ${flag}`,
          { env },
        );

        expect(stdout).toContain('CLI validation failure (SNYK-CLI-0010)');
        expect(code).toBe(EXIT_CODES.ERROR);
      },
    );
  });
});
