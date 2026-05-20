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

  it('filters out secret findings when using --severity-threshold', async () => {
    const { code, stdout } = await runSnykCLI(
      `secrets test --severity-threshold=critical --sarif ${TEMP_LOCAL_PATH}/${TEST_DIR}`,
      { env },
    );

    const sarifOutput = JSON.parse(stdout);

    // examples/ contains a single critical-severity private key, which is kept at
    // --severity-threshold=critical; any lower-severity findings would be filtered out.
    const findings = sarifOutput.runs[0].results;
    expect(findings).toHaveLength(1);
    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
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
  });

  describe('JSON output payload validation', () => {
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
  describe('SARIF output payload validation', () => {
    it('should generate a well-formed SARIF payload', async () => {
      // Scan the whole repo (not just examples/) so we get enough results
      // to validate multi-location grouping.
      const { code, stdout, stderr } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH} --sarif`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);

      const sarifOutput = JSON.parse(stdout);
      const identityRegex =
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
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
        expect(rule).toHaveProperty('shortDescription.text');
      });

      let foundMultipleLocations = false;
      const results = run.results || [];

      results.forEach((result: any) => {
        expect(result.ruleId).toMatch(slugRegex);

        // Validates: identity fingerprint is included in the result and is a UUID
        expect(result).toHaveProperty('fingerprints');
        expect(result.fingerprints).toHaveProperty('identity');
        expect(result.fingerprints.identity).toMatch(identityRegex);

        expect(Array.isArray(result.locations)).toBe(true);
        expect(result.locations.length).toBeGreaterThan(0);

        // Tracks if we successfully grouped multiple locations into a single result
        if (result.locations.length > 1) {
          foundMultipleLocations = true;
        }
      });

      expect(foundMultipleLocations).toBe(true);
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

      // Helper to extract and sort identities so order doesn't cause false failures.
      // Asserts every result has a defined identity so the comparison can't pass on undefineds.
      const getIdentities = (results: any[]) => {
        const identities = results.map((r: any) => {
          expect(r.fingerprints?.identity).toBeDefined();
          return r.fingerprints.identity;
        });
        return identities.sort();
      };

      const identitiesA = getIdentities(resultsA);
      const identitiesC = getIdentities(resultsC);

      // Identities must be exactly the same, as they are computed relative to the git root
      expect(identitiesA).toEqual(identitiesC);
    });
  });

  describe('validation', () => {
    it('should run with --report', async () => {
      const { code, stdout } = await runSnykCLI(
        `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR} --report`,
        { env },
      );

      expect(stdout).toContain('Your test results are available at:');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
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
