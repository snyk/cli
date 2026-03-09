import { execSync } from 'child_process';
import {
  existsSync,
  unlinkSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  readdirSync,
  statSync,
} from 'fs';
import { matchers } from 'jest-json-schema';
import { runSnykCLI } from '../../util/runSnykCLI';
import { EXIT_CODES } from '../../../../src/cli/exit-codes';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { makeTmpDirectory } from '../../../utils';

expect.extend(matchers);
jest.setTimeout(1000 * 300);

const projectRoot = resolve(__dirname, '../../../..');

const TEST_REPO_COMMIT = '366ae0080cc67973619584080fc85734ba2658b2';
const TEST_REPO_URL = 'https://github.com/leaktk/fake-leaks';
const TEST_DIR = 'examples';
const TEST_FILE = 'some/long/path/server.key';

// Global variable to store the path of the cloned repo for this run
let TEMP_LOCAL_PATH: string;

const env = {
  ...process.env,
  INTERNAL_SNYK_FEATURE_FLAG_IS_SECRETS_ENABLED: 'true',
  SNYK_API: process.env.TEST_SNYK_API_DEV,
  SNYK_TOKEN: process.env.TEST_SNYK_TOKEN_DEV,
};

beforeAll(async () => {
  TEMP_LOCAL_PATH = await makeTmpDirectory();

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
  } catch (error: any) {
    throw new Error(
      `Failed to clone test repository: ${error.message}. This test requires network access.`,
    );
  }
});

afterAll(() => {
  if (existsSync(TEMP_LOCAL_PATH)) {
    try {
      rmSync(TEMP_LOCAL_PATH, { recursive: true, force: true });
    } catch (err: any) {
      console.warn('Failed to cleanup test repository:', err.message);
    }
  }
});

const copyFolderSync = (from: string, to: string) => {
  mkdirSync(to, { recursive: true });
  readdirSync(from).forEach((element) => {
    const fromPath = join(from, element);
    const toPath = join(to, element);
    if (statSync(fromPath).isFile()) copyFileSync(fromPath, toPath);
    else copyFolderSync(fromPath, toPath);
  });
};

/**
 * Sets up an isolated environment for testing the 'ignore' functionality.
 * * Why this is necessary:
 * - Generates unique secret identities within a dedicated temporary folder.
 * - Isolates local state mutations (like .snyk file creation).
 * - Prevents race conditions during concurrent test execution, guaranteeing
 * zero side-effects on other acceptance tests.
 */
const setupIsolatedIgnoreEnv = async (basePath: string) => {
  const uuid = randomUUID();
  const testDir = `${basePath}/ignores_test_${uuid}`;

  // Calculate an expiry date 15 minutes from now in YYYY-MM-DDThh:mm:ss.fffZ format
  const expiryDate = new Date(Date.now() + 15 * 60000).toISOString();

  const cleanup = () => {
    if (existsSync(testDir)) {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch (err: any) {
        console.warn(
          `Failed to cleanup isolated ignore directory:`,
          err.message,
        );
      }
    }
  };

  try {
    mkdirSync(testDir, { recursive: true });

    // Copy the same file twice to trigger the same rule ID for multiple locations in SARIF validation
    const sourceFile = join(
      basePath,
      'semgrep-rules-examples',
      'detected-sendgrid-api-key.txt',
    );

    copyFileSync(sourceFile, join(testDir, `sendgrid-keys_1_${uuid}.txt`));
    copyFileSync(sourceFile, join(testDir, `sendgrid-keys_2_${uuid}.txt`));

    // Run a base JSON scan to extract the exact finding IDs for these files
    const { stdout: jsonStdout } = await runSnykCLI(
      `secrets test ${testDir} --json`,
      { env },
    );
    const jsonOutput = JSON.parse(jsonStdout);
    const results = jsonOutput.runs[0].results || [];

    const findingIds = [
      ...new Set(
        results.map((r: any) => r.fingerprints?.identity).filter(Boolean),
      ),
    ];
    const issuesToIgnore = findingIds.slice(0, 2);

    // Ignore the target issues
    for (const [index, issueId] of issuesToIgnore.entries()) {
      const reason = `Test ignore reason metadata ${index}`;
      await runSnykCLI(
        `ignore --id=${issueId} --expiry=${expiryDate} --reason=${reason}`,
        { env, cwd: testDir },
      );
    }

    return { testDir, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
};

describe('snyk secrets test', () => {
  describe('output formats', () => {
    it('should display human-readable output by default', async () => {
      const { code, stderr } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR}`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
    });

    it.skip('should display sarif output with --sarif', async () => {
      const { code, stderr } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR} --sarif`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
    });

    it.skip('should write sarif to output file with --sarif-file-output', async () => {
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

  // TODO: Re-enable once SARIF and JSON WIP outputs are finalized [PS-533]
  it.skip('filters out secret findings when using --severity-threshold', async () => {
    const { code, stdout } = await runSnykCLI(
      `secrets test --severity-threshold=critical --sarif ${TEMP_LOCAL_PATH}/${TEST_DIR}`,
      { env },
    );

    const sarifOutput = JSON.parse(stdout);

    const findings = sarifOutput.runs[0].results;
    expect(findings).toHaveLength(0);
    expect(code).toBe(0);
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

  describe('Human-readable output validation', () => {
    it('should generate properly formatted human-readable output and map Finding IDs correctly', async () => {
      const { code, stdout, stderr } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR}`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);

      expect(stdout).toContain('Open Secrets issues:');
      expect(stdout).toContain('Test Summary');
      expect(stdout).toContain('Total secrets issues:');

      // Validates: Finding ID is mapped correctly to a UUID string
      const uuidRegex =
        /Finding ID: [0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
      expect(stdout).toMatch(uuidRegex);
    });

    it('should omit Finding IDs that start with UNDEFINED', async () => {
      // Create a path outside of the repo to remove source used to generate secret identities
      const NO_GIT_DIR = await makeTmpDirectory();

      try {
        // Copy just the test files
        copyFolderSync(join(TEMP_LOCAL_PATH, TEST_DIR), NO_GIT_DIR);

        const { code, stdout, stderr } = await runSnykCLI(
          `secrets test ${NO_GIT_DIR}`,
          { env },
        );

        expect(stderr).toBe('');
        expect(code).toBe(EXIT_CODES.VULNS_FOUND);

        // Finding ID should not be included when it starts with UNDEFINED
        expect(stdout).not.toContain('Finding ID');
      } finally {
        try {
          rmSync(NO_GIT_DIR, { recursive: true, force: true });
        } catch (err: any) {
          console.warn(
            `Failed to cleanup non-git test directory:`,
            err.message,
          );
        }
      }
    });
    // TODO: Re-enable once SARIF and JSON WIP outputs are finalized [PS-533]
    it.skip('should correctly render multiple ignores and their metadata in the output', async () => {
      const { testDir, cleanup } =
        await setupIsolatedIgnoreEnv(TEMP_LOCAL_PATH);

      try {
        // Get human-readable with the ignores included
        const { stdout, stderr, code } = await runSnykCLI(
          `secrets test ${testDir} --include-ignores`,
          { env, cwd: testDir },
        );

        expect(stderr).toBe('');
        expect(code).toBe(EXIT_CODES.VULNS_FOUND);

        // Multiple ignores are rendered properly
        expect(stdout).toMatch(/Ignored:\s*[2-9]/);
        expect(stdout).toContain('! [IGNORED]');

        // Validate ignores metadata is mapped and rendered correctly
        // Validates Expiration format
        expect(stdout).toMatch(/Expiration:\s+[A-Z][a-z]+\s+\d{2},\s+\d{4}/);

        // Validates the Reason field and spacing
        expect(stdout).toMatch(/Reason:\s+Test ignore reason metadata 0/);
        expect(stdout).toMatch(/Reason:\s+Test ignore reason metadata 1/);
        expect(stdout).toMatch(/Ignored on:\s+[A-Z][a-z]+\s+\d{2},\s+\d{4}/);
      } finally {
        cleanup();
      }
    });
  });

  // TODO: Re-enable once SARIF and JSON WIP outputs are finalized [PS-533]
  describe.skip('JSON output payload validation', () => {
    it('should return a valid SARIF when json flag is used', async () => {
      const { code, stdout, stderr } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR} --json`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);

      const output = JSON.parse(stdout);

      // Basic SARIF schema requirements
      expect(output).toHaveProperty('version');
      expect(typeof output.version).toBe('string');
      expect(Array.isArray(output.runs)).toBe(true);
      expect(output.runs.length).toBeGreaterThan(0);

      const run = output.runs[0];

      expect(run.tool.driver.name).toBe('Snyk Secrets');

      // Results array exists and is populated
      expect(Array.isArray(run.results)).toBe(true);
      expect(run.results.length).toBeGreaterThan(0);

      // Ensure the first result has the expected ruleId mapping
      expect(run.results[0]).toHaveProperty('ruleId');
    });
  });
  // TODO: Re-enable once SARIF and JSON WIP outputs are finalized [PS-533]
  describe.skip('SARIF output payload validation', () => {
    it('should generate an enriched SARIF payload with ignores', async () => {
      const { testDir, cleanup } =
        await setupIsolatedIgnoreEnv(TEMP_LOCAL_PATH);

      try {
        const { code, stdout, stderr } = await runSnykCLI(
          `secrets test ${testDir} --include-ignores --sarif`,
          { env, cwd: testDir },
        );

        expect(stderr).toBe('');
        expect(code).toBe(EXIT_CODES.VULNS_FOUND);

        const sarifOutput = JSON.parse(stdout);
        const fingerprintRegex = /^[a-f0-9]{64}$/i;
        const slugRegex = /^[a-z0-9-]+$/;

        // Only one run is performed
        const run = sarifOutput.runs[0];

        expect(run.tool.driver.name).toBe('Snyk Secrets');

        const rules = run.tool.driver.rules || [];
        const ruleIds = rules.map((rule: any) => rule.id);
        const uniqueRuleIds = new Set(ruleIds);

        // Rules should only be included once in the SARIF, and not multiple times
        expect(ruleIds.length).toBe(uniqueRuleIds.size);

        rules.forEach((rule: any) => {
          expect(rule.id).toMatch(slugRegex);

          // Rules should have name
          expect(rule).toHaveProperty('name');

          // Validates: the properties from the rules include the severity
          expect(rule.properties).toBeDefined();
          expect(rule.properties).toHaveProperty('severity');

          // General structural checks
          expect(rule).toHaveProperty('shortDescription.text');
        });

        let foundMultipleLocations = false;
        const results = run.results || [];

        results.forEach((result: any) => {
          expect(result.ruleId).toMatch(slugRegex);

          // Validates: fingerprint is included in the result
          expect(result).toHaveProperty('fingerprints');
          expect(result.fingerprints).toHaveProperty('fingerprint');
          expect(result.fingerprints.fingerprint).toMatch(fingerprintRegex);

          expect(Array.isArray(result.locations)).toBe(true);
          expect(result.locations.length).toBeGreaterThan(0);

          // Tracks if we successfully grouped multiple locations into a single result
          if (result.locations.length > 1) {
            foundMultipleLocations = true;
          }

          // Validate ignores metadata includes only these fields: status, justification, kind
          if (result.suppressions && result.suppressions.length > 0) {
            result.suppressions.forEach((suppression: any) => {
              const suppressionKeys = Object.keys(suppression).sort();
              const expectedKeys = ['justification', 'kind', 'status'].sort();
              expect(suppressionKeys).toEqual(expectedKeys);
            });
          }
        });

        expect(foundMultipleLocations).toBe(true);
      } finally {
        cleanup();
      }
    });
    it('should ensure consistent secret identities regardless of the working directory', async () => {
      // Use existing directories from the repo tree to test different path depths
      // DIR_A is 1 level deep, DIR_C is 2 levels deep
      const DIR_A = `${TEMP_LOCAL_PATH}/auth0`;
      const DIR_C = `${TEMP_LOCAL_PATH}/aws/valid`;

      const targetDir = 'semgrep-rules-examples';

      // Run scan from DIR_A
      const { stdout: stdoutA, stderr: stderrA } = await runSnykCLI(
        `secrets test ../${targetDir} --sarif`,
        { env, cwd: DIR_A },
      );
      expect(stderrA).toBe('');

      // Run scan from DIR_C
      const { stdout: stdoutC, stderr: stderrC } = await runSnykCLI(
        `secrets test ../../${targetDir} --sarif`,
        { env, cwd: DIR_C },
      );
      expect(stderrC).toBe('');

      const sarifA = JSON.parse(stdoutA);
      const sarifC = JSON.parse(stdoutC);

      const resultsA = sarifA.runs[0].results || [];
      const resultsC = sarifC.runs[0].results || [];

      // Ensure we actually scanned and found the secrets
      expect(resultsA.length).toBeGreaterThan(0);
      expect(resultsA.length).toBe(resultsC.length);

      // Helper to extract and sort fingerprints so order doesn't cause false failures
      const getFingerprints = (results: any[]) =>
        results.map((r: any) => r.fingerprints?.fingerprint).sort();

      const fingerprintsA = getFingerprints(resultsA);
      const fingerprintsC = getFingerprints(resultsC);

      // Identities must be exactly the same, as they are computed relative to the git root
      expect(fingerprintsA).toEqual(fingerprintsC);
    });
  });

  describe('validation', () => {
    // Skipped because --report functionality is not yet fully functional [PS-533]
    it.skip('should return an error for --report', async () => {
      const { code, stdout } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR} --report`,
        { env },
      );

      expect(stdout).toContain('Feature not enabled');
      expect(code).toBe(EXIT_CODES.ERROR);
    });

    it('should return an error for invalid value of --severity-threshold', async () => {
      const { code, stdout } = await runSnykCLI(
        `secrets test --severity-threshold=none ${TEMP_LOCAL_PATH}/${TEST_DIR}`,
        { env },
      );

      expect(stdout).toContain('CLI validation failure (SNYK-CLI-0010)');
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
