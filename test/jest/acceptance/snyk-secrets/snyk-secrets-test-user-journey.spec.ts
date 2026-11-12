import { execSync } from 'child_process';
import {
  existsSync,
  unlinkSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  readFileSync,
} from 'fs';
import { matchers } from 'jest-json-schema';
import { runSnykCLI } from '../../util/runSnykCLI';
import { EXIT_CODES } from '../../../../src/cli/exit-codes';
import { join } from 'path';
import { makeTmpDirectory } from '../../../utils';
import {
  USER_JOURNEY_CLI_TIMEOUT_SECS,
  USER_JOURNEY_JEST_TIMEOUT_MS,
} from '../../util/constants';

expect.extend(matchers);
jest.setTimeout(USER_JOURNEY_JEST_TIMEOUT_MS);

const TEST_REPO_COMMIT = 'f15521a2b100276d598410a9e1e46a11a397ad7e';
const TEST_REPO_URL = 'https://github.com/leaktk/fake-leaks';
const TEST_DIR = 'examples';
const TEST_FILE = 'some/long/path/server.key';
const FILE_WITH_GENERIC_SECRET = 'allow-comment.py';
const DIR_WITH_PRIVATE_KEY = 'some/long/path';

// Global variable to store the path of the cloned repo for this run
let TEMP_LOCAL_PATH: string;

// Unfiltered scan of examples/, taken before any test writes a .snyk there.
// Filter tests compare against it so they fail loudly if there was nothing to filter.
let examplesBaseline: any;

const env = {
  ...process.env,
  SNYK_TIMEOUT_SECS: USER_JOURNEY_CLI_TIMEOUT_SECS,
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

  examplesBaseline = (await scanSarif(`${TEMP_LOCAL_PATH}/${TEST_DIR}`)).sarif;
  assertSarifShape(examplesBaseline);
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

// Guards against an empty/malformed SARIF
// so failures surface as readable assertion messages
function assertSarifShape(sarifOutput: any): void {
  expect(Array.isArray(sarifOutput?.runs)).toBe(true);
  expect(sarifOutput.runs.length).toBeGreaterThan(0);
  expect(Array.isArray(sarifOutput.runs[0]?.results)).toBe(true);
}

async function scanSarif(
  target: string,
  flags = '',
): Promise<{ code: number; stderr: string; sarif: any }> {
  const { code, stdout, stderr } = await runSnykCLI(
    `secrets test ${target} --sarif ${flags}`,
    { env },
  );
  return { code, stderr, sarif: JSON.parse(stdout) };
}

function suppressedResults(sarifOutput: any): any[] {
  return sarifOutput.runs[0].results.filter(
    (result: any) => result.suppressions,
  );
}

// Finding counts move with the detection model and the server-side ignores in the
// test org, so only require that at least one ignored finding is reported.
function checkSarif(sarifOutput: any): any {
  assertSarifShape(sarifOutput);
  expect(suppressedResults(sarifOutput).length).toBeGreaterThan(0);
  return sarifOutput;
}

function reportedFiles(sarifOutput: any): string[] {
  return sarifOutput.runs[0].results.flatMap((result: any) =>
    result.locations.map(
      (location: any) => location.physicalLocation.artifactLocation.uri,
    ),
  );
}

// SARIF level "error" covers both critical and high; only the message text carries the severity word.
function severityOf(result: any): string | undefined {
  return result.message?.text
    ?.match(/\b(critical|high|medium|low) severity\b/i)?.[1]
    .toLowerCase();
}

function severities(sarifOutput: any): Set<string | undefined> {
  return new Set(sarifOutput.runs[0].results.map(severityOf));
}

function ignoredCountInSummary(stdout: string): number {
  return Number(stdout.match(/Ignored:\s*(\d+)/)?.[1]);
}

function writeDotSnyk(path: string, contents: string): void {
  writeFileSync(join(path, '.snyk'), contents, 'utf8');
}

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

    it.each(['--sarif-file-output', '--json-file-output'])(
      'should write results to a file relative to the working directory with %s',
      async (flag) => {
        const outputDir = await makeTmpDirectory();
        const outputFile = 'secrets-results.json';

        try {
          const { code, stdout, stderr } = await runSnykCLI(
            `secrets test ${TEMP_LOCAL_PATH}/${TEST_DIR} ${flag}=${outputFile}`,
            { env, cwd: outputDir },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODES.VULNS_FOUND);
          expect(stdout).toContain('Open Secrets issues:');

          const written = JSON.parse(
            readFileSync(join(outputDir, outputFile), 'utf8'),
          );
          assertSarifShape(written);
          expect(reportedFiles(written).sort()).toEqual(
            reportedFiles(examplesBaseline).sort(),
          );
        } finally {
          rmSync(outputDir, { recursive: true, force: true });
        }
      },
    );
  });

  it('filters out secret findings when using --severity-threshold', async () => {
    expect(severities(examplesBaseline)).toContain('critical');
    expect(severities(examplesBaseline).size).toBeGreaterThan(1);

    const { code, stderr, sarif } = await scanSarif(
      `${TEMP_LOCAL_PATH}/${TEST_DIR}`,
      '--severity-threshold=critical',
    );

    expect(stderr).toBe('');
    assertSarifShape(sarif);
    expect(severities(sarif)).toEqual(new Set(['critical']));
    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  it('exits 0 with no results when no secrets are found', async () => {
    const cleanDir = await makeTmpDirectory();

    try {
      writeFileSync(join(cleanDir, 'hello.py'), 'print("hello")\n');

      const { code, stderr, sarif } = await scanSarif(cleanDir);

      expect(stderr).toBe('');
      assertSarifShape(sarif);
      expect(sarif.runs[0].results).toHaveLength(0);
      expect(code).toBe(0);
    } finally {
      rmSync(cleanDir, { recursive: true, force: true });
    }
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
      expect(Number(stdout.match(/Total secrets issues:\s*(\d+)/)?.[1])).toBe(
        examplesBaseline.runs[0].results.length,
      );

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

      expect(reportedFiles(output).sort()).toEqual(
        reportedFiles(examplesBaseline).sort(),
      );
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
      expect(rules.length).toBeGreaterThan(0);

      rules.forEach((rule: any) => {
        expect(rule.id).toMatch(slugRegex);
        expect(rule).toHaveProperty('shortDescription.text');
      });

      let foundMultipleLocations = false;
      const results = run.results || [];
      expect(results.length).toBeGreaterThan(0);

      results.forEach((result: any) => {
        expect(result.ruleId).toMatch(slugRegex);
        expect(uniqueRuleIds).toContain(result.ruleId);

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

  describe('with ignored issues', () => {
    // semgrep-rules-examples has findings at several severities; the ignores are held server-side in the test org.
    const ignoresTarget = () => `${TEMP_LOCAL_PATH}/semgrep-rules-examples`;
    let ignoresBaseline: Awaited<ReturnType<typeof scanSarif>>;

    beforeAll(async () => {
      ignoresBaseline = await scanSarif(ignoresTarget());
    });

    it('filters below-threshold ignored findings with --severity-threshold', async () => {
      expect(severities(ignoresBaseline.sarif)).toContain('critical');
      expect(severities(ignoresBaseline.sarif).size).toBeGreaterThan(1);

      const { stderr, code, sarif } = await scanSarif(
        ignoresTarget(),
        '--severity-threshold=critical',
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
      checkSarif(sarif);
      expect(severities(sarif)).toEqual(new Set(['critical']));
    });

    it('renders ignore metadata in human-readable output with --include-ignores', async () => {
      const { stdout, stderr, code } = await runSnykCLI(
        `secrets test ${ignoresTarget()} --include-ignores`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);

      // One [IGNORED] marker per ignored finding, agreeing with the summary and the SARIF suppressions.
      const ignoredMarkers = stdout.match(/\[\s*IGNORED\s*\]/gi) || [];
      expect(ignoredMarkers.length).toBeGreaterThan(0);
      expect(ignoredCountInSummary(stdout)).toBe(ignoredMarkers.length);
      expect(ignoredMarkers.length).toBe(
        suppressedResults(ignoresBaseline.sarif).length,
      );

      // Ignore metadata is rendered for every ignored finding.
      expect(stdout).toMatch(/Reason:\s+\S+/);
      expect(stdout).toMatch(
        /Expiration:\s+(?:[A-Z][a-z]+\s+\d{1,2},\s+\d{4}|never)/,
      );
      expect(stdout).toMatch(/Ignored on:\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}/);
    });

    it('emits suppressions in SARIF', async () => {
      const { stderr, code, sarif } = ignoresBaseline;

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
      checkSarif(sarif);

      // SARIF suppressions carry the core ignore metadata fields.
      suppressedResults(sarif).forEach((result: any) => {
        expect(result.suppressions.length).toBeGreaterThan(0);
        result.suppressions.forEach((suppression: any) => {
          expect(suppression).toHaveProperty('status');
          expect(suppression).toHaveProperty('justification');
          expect(suppression).toHaveProperty('kind');
        });
      });
    });

    it('omits ignored findings from human-readable output by default', async () => {
      const { stdout, stderr, code } = await runSnykCLI(
        `secrets test ${ignoresTarget()}`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);

      // Per-finding ignore output ([IGNORED] markers and metadata) is suppressed
      // unless --include-ignores is passed. The summary line still reports a count,
      // which proves there were ignored findings to omit.
      expect(ignoredCountInSummary(stdout)).toBeGreaterThan(0);
      expect(stdout).not.toMatch(/\[\s*IGNORED\s*\]/i);
      expect(stdout).not.toMatch(/Reason:\s+\S+/);
      expect(stdout).not.toMatch(
        /Ignored on:\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}/,
      );
    });
  });

  describe('exclusions', () => {
    const examplesDir = () => join(TEMP_LOCAL_PATH, TEST_DIR);

    afterEach(() => {
      const dotSnykPath = join(examplesDir(), '.snyk');
      if (existsSync(dotSnykPath)) {
        unlinkSync(dotSnykPath);
      }
    });

    async function scanExamples(flags = ''): Promise<string[]> {
      // Each case must drop a file the unfiltered scan reports, while the other file
      // stays reported, so an empty or broken scan cannot pass.
      expect(reportedFiles(examplesBaseline)).toEqual(
        expect.arrayContaining([FILE_WITH_GENERIC_SECRET, TEST_FILE]),
      );

      const { code, stderr, sarif } = await scanSarif(examplesDir(), flags);

      expect(stderr).toBe('');
      assertSarifShape(sarif);
      const files = reportedFiles(sarif);
      // Excluded findings must not affect the exit code.
      expect(code).toBe(files.length > 0 ? EXIT_CODES.VULNS_FOUND : 0);
      return files;
    }

    it('applies the "global" exclude section', async () => {
      writeDotSnyk(
        examplesDir(),
        `version: v1.25.1
exclude:
  global:
    - ${DIR_WITH_PRIVATE_KEY}
`,
      );

      const files = await scanExamples();

      expect(files).not.toContain(TEST_FILE);
      expect(files).toContain(FILE_WITH_GENERIC_SECRET);
    });

    it('applies the "secrets" exclude section', async () => {
      writeDotSnyk(
        examplesDir(),
        `version: v1.25.1
exclude:
  secrets:
    - ${FILE_WITH_GENERIC_SECRET}
`,
      );

      const files = await scanExamples();

      expect(files).not.toContain(FILE_WITH_GENERIC_SECRET);
      expect(files).toContain(TEST_FILE);
    });

    it('combines the "global" and "secrets" exclude sections', async () => {
      writeDotSnyk(
        examplesDir(),
        `version: v1.25.1
exclude:
  global:
    - ${DIR_WITH_PRIVATE_KEY}
  secrets:
    - ${FILE_WITH_GENERIC_SECRET}
`,
      );

      const files = await scanExamples();

      expect(files).not.toContain(TEST_FILE);
      expect(files).not.toContain(FILE_WITH_GENERIC_SECRET);
    });

    it('excludes files by name with --exclude', async () => {
      const files = await scanExamples(`--exclude=${FILE_WITH_GENERIC_SECRET}`);

      expect(files).not.toContain(FILE_WITH_GENERIC_SECRET);
      expect(files).toContain(TEST_FILE);
    });
  });
});
