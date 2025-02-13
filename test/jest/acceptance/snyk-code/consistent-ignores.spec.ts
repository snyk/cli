import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { runSnykCLI } from '../../util/runSnykCLI';

// This method does some basic checks on the given sarif file
function checkSarif(file: string, expectedIgnoredFindings: number): any {
  expect(existsSync(file)).toBe(true);

  const sarifOutput = JSON.parse(readFileSync(file, 'utf8'));

  // Check that the SARIF payload contains all expected fingerprints including identity and snyk/asset/finding/v1
  const fingerprints = sarifOutput.runs[0].results.flatMap(
    (result) => result.fingerprints || [],
  );
  expect(fingerprints).toContainEqual(
    expect.objectContaining({ identity: expect.any(String) }),
  );
  expect(fingerprints).toContainEqual(
    expect.objectContaining({
      'snyk/asset/finding/v1': expect.any(String),
    }),
  );

  const suppressions = sarifOutput.runs[0].results.filter(
    (result) => result.suppressions,
  );
  expect(suppressions.length).toBe(expectedIgnoredFindings);

  return sarifOutput;
}

interface IgnoreTests {
  name: string;
  expectedExitCode: number;
  expectedIgnoredIssuesHigh: number;
  expectedIgnoredIssuesMedium: number;
  pathToTest: string;
}

const repoUrl = 'https://github.com/snyk/snyk-goof.git';
const localPath = '/tmp/snyk-goof';
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_ACTION_NEEDED = 1;


const ignoreTestList: IgnoreTests[] = [
  {
    name: 'given 4 issues are ignored and 5 open issues are present',
    expectedExitCode: EXIT_CODE_ACTION_NEEDED,
    expectedIgnoredIssuesHigh: 1,
    expectedIgnoredIssuesMedium: 3,
    pathToTest: localPath,
  },
  {
    name: 'given 4 issues are ignored and 0 open issues are present',
    expectedExitCode: EXIT_CODE_SUCCESS,
    expectedIgnoredIssuesHigh: 1,
    expectedIgnoredIssuesMedium: 3,
    pathToTest: `${localPath}/routes`,
  },
];
const projectRoot = resolve(__dirname, '../../../..');

describe.each(ignoreTestList)(
  `with ignored issues`,
  ({
    name,
    expectedExitCode,
    expectedIgnoredIssuesHigh,
    expectedIgnoredIssuesMedium,
    pathToTest,
  }) => {
    const expectedIgnoredIssuesAll =
      expectedIgnoredIssuesHigh + expectedIgnoredIssuesMedium;
    const sarifFile = `${projectRoot}/sarifOutput.json`;
    beforeAll(() => {
        if (!existsSync(localPath)) {
          // Clone the repository
          execSync(`git clone ${repoUrl} ${localPath}`, { stdio: 'inherit' });
        }
    })
    afterAll(() => {
      if (existsSync(localPath)) {
        rmSync(localPath, { recursive: true })
      }
    })

    describe(`${name}`, () => {
      jest.setTimeout(2 * 60 * 1000);
      afterEach(() => {
        // Cleanup SARIF file
        try {
          unlinkSync(sarifFile);
        } catch (error) {
          // nothing
        }
      });

      it('with --severity-threashold', async () => {
        const { stdout, stderr, code } = await runSnykCLI(
          `code test ${pathToTest} --severity-threshold=high --sarif-file-output=${sarifFile}`,
          {
            env: {
              INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'true',
              ...process.env,
            },
          },
        );

        expect(stderr).toBe('');
        expect(stdout).toContain(
          `Ignored issues: ${expectedIgnoredIssuesHigh}`,
        );
        expect(stdout.toLowerCase()).not.toContain('[medium]');
        expect(code).toBe(expectedExitCode);

        // Verify SARIF file
        const sarifOutput = checkSarif(sarifFile, expectedIgnoredIssuesHigh);

        const levels = sarifOutput.runs[0].results.filter(
          (result) => result.level.toLowerCase() == 'warning',
        );
        expect(levels.length).toBe(0);
      });

      it('with --include-ignores', async () => {
        const { stdout, stderr, code } = await runSnykCLI(
          `code test ${pathToTest} --include-ignores --sarif-file-output=${sarifFile}`,
          {
            env: {
              INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'true',
              ...process.env,
            },
          },
        );

        expect(stderr).toBe('');
        const ignoredCount = (stdout.match(/\[ IGNORED \]/g) || []).length;
        expect(ignoredCount).toBe(expectedIgnoredIssuesAll);
        expect(code).toBe(expectedExitCode);

        // Verify SARIF file
        checkSarif(sarifFile, expectedIgnoredIssuesAll);
      });
    });
  },
);
