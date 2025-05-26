import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI, runSnykCLIWithArray } from '../../util/runSnykCLI';
import { matchers } from 'jest-json-schema';
import { resolve } from 'path';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { runCommand } from '../../util/runCommand';
import * as fs from 'fs-extra';
import { makeTmpDirectory } from '../../../utils';
import * as crypto from 'crypto';

expect.extend(matchers);
jest.setTimeout(1000 * 120);

interface Workflow {
  type: string;
  env: { [key: string]: string | undefined };
}

interface IgnoreTests {
  name: string;
  expectedExitCode: number;
  expectedIgnoredIssuesHigh: number;
  expectedIgnoredIssuesMedium: number;
  pathToTest: string;
}

const projectRoot = resolve(__dirname, '../../../..');
const sarifSchema = require('../../../schemas/sarif-schema-2.1.0.json');
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_ACTION_NEEDED = 1;
const EXIT_CODE_FAIL_WITH_ERROR = 2;
const EXIT_CODE_NO_SUPPORTED_FILES = 3;
const repoUrl = 'https://github.com/snyk/snyk-goof.git';
const localPath = '/tmp/snyk-goof';

// expected Code Security Issues: 6 -  5 [High] 1 [Low]
// expected Code Quality Issues: 2 -  2 [Medium]
const projectWithCodeIssues = resolve(
  projectRoot,
  'test/fixtures/sast/with_code_issues',
);
const emptyProject = resolve(projectRoot, 'test/fixtures/empty');

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

async function ensureUniqueBundleIsUsed(path: string): Promise<string> {
  const newPath = await makeTmpDirectory();
  try {
    fs.copySync(path, newPath, { recursive: true });
  } catch (error) {
    console.error(`Error copying directory from ${path} to ${newPath}:`, error);
    throw error; // Re-throw to fail the test clearly
  }

  // add a random file to ensure a new bundle is created
  const randomBytes: Buffer = crypto.randomBytes(100);
  fs.writeFileSync(`${newPath}/tmp.java`, randomBytes, { encoding: 'binary' });
  return newPath;
}

const userJourneyWorkflows: Workflow[] = [
  {
    type: 'typescript',
    env: {
      // force use of legacy implementation
      INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'false',
      INTERNAL_SNYK_CODE_NATIVE_IMPLEMENTATION: 'false',
      SNYK_CFG_ORG: process.env.TEST_SNYK_ORG_SLUGNAME,
    },
  },
  {
    type: 'golang/native',
    env: {
      INTERNAL_SNYK_CODE_NATIVE_IMPLEMENTATION: 'true',
      SNYK_CFG_ORG: process.env.TEST_SNYK_ORG_SLUGNAME,
    },
  },
];

describe('snyk code test', () => {
  beforeAll(() => {
    if (!existsSync(localPath)) {
      // Clone the repository
      execSync(`git clone ${repoUrl} ${localPath}`, { stdio: 'inherit' });
    }
  });

  afterAll(() => {});

  describe.each(userJourneyWorkflows)(
    'user journey',
    ({ type, env: integrationEnv }) => {
      describe(`${type} workflow`, () => {
        describe('snyk code flag options', () => {
          it('works with --remote-repo-url', async () => {
            const expectedCodeSecurityIssues = 6;
            const path = await ensureUniqueBundleIsUsed(projectWithCodeIssues);
            const { stdout } = await runSnykCLI(
              `code test ${path} --remote-repo-url=https://github.com/snyk/cli.git --json -d`,
              {
                env: {
                  ...process.env,
                  ...integrationEnv,
                },
              },
            );

            const actualCodeSecurityIssues =
              JSON.parse(stdout)?.runs[0]?.results?.length;
            expect(actualCodeSecurityIssues).toEqual(
              expectedCodeSecurityIssues,
            );
          });

          it('works with --severity-threshold', async () => {
            const expectedHighCodeSecurityIssues = 5;
            const path = await ensureUniqueBundleIsUsed(projectWithCodeIssues);
            const { stdout } = await runSnykCLI(
              `code test ${path} --json --severity-threshold=high`,
              {
                env: {
                  ...process.env,
                  ...integrationEnv,
                },
              },
            );

            const actualCodeSecurityIssues =
              JSON.parse(stdout)?.runs[0]?.results?.length;
            expect(actualCodeSecurityIssues).toEqual(
              expectedHighCodeSecurityIssues,
            );
          });

          if (type === 'typescript') {
            it('works with --org', async () => {
              const MADE_UP_ORG_WITH_NO_SNYK_CODE_PERMISSIONS =
                'madeUpOrgWithNoSnykCodePermissions';

              const path = await ensureUniqueBundleIsUsed(
                projectWithCodeIssues,
              );

              const { stdout, code } = await runSnykCLI(
                `code test ${path} --org=${MADE_UP_ORG_WITH_NO_SNYK_CODE_PERMISSIONS}`,
                {
                  env: {
                    ...process.env,
                    ...integrationEnv,
                  },
                },
              );

              expect(stdout).toContain(
                `Org ${MADE_UP_ORG_WITH_NO_SNYK_CODE_PERMISSIONS} was not found`,
              );
              expect(code).toBe(EXIT_CODE_FAIL_WITH_ERROR);
            });
          }
        });

        it('works on projects with no git context', async () => {
          // createProjectFromFixture creates a new project without gitcontext
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );

          const tmpPath = await ensureUniqueBundleIsUsed(path());

          const { stderr, code } = await runSnykCLI(`code test ${tmpPath}`, {
            env: {
              ...process.env,
              ...integrationEnv,
            },
          });

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
        });

        it('should succeed - when no vulnerabilities found', async () => {
          const noVulnsProject = resolve(
            projectRoot,
            'test/fixtures/sast/no-vulnerabilities',
          );

          const path = await ensureUniqueBundleIsUsed(noVulnsProject);

          const { stderr, code } = await runSnykCLI(`code test ${path}`, {
            env: {
              ...process.env,
              ...integrationEnv,
            },
          });

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_SUCCESS);
        });

        it('should not include code quality issues in results', async () => {
          // expected Code Quality Issues: 2 -  2 [Medium]
          const expectedCodeSecurityIssues = 6;
          const path = await ensureUniqueBundleIsUsed(projectWithCodeIssues);

          const { stdout } = await runSnykCLI(`code test ${path} --json`, {
            env: {
              ...process.env,
              ...integrationEnv,
            },
          });

          const actualCodeSecurityIssues =
            JSON.parse(stdout)?.runs[0]?.results?.length;
          expect(actualCodeSecurityIssues).toEqual(expectedCodeSecurityIssues);
        });

        it('should fail with correct exit code - when testing empty project', async () => {
          const { stderr, code } = await runSnykCLI(
            `code test ${emptyProject}`,
            {
              env: {
                ...process.env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_NO_SUPPORTED_FILES);
        });

        it('should fail with correct exit code - when using invalid token', async () => {
          const { stderr, code } = await runSnykCLI(
            `code test ${projectWithCodeIssues}`,
            {
              env: {
                ...process.env,
                ...integrationEnv,
                SNYK_TOKEN: 'woof',
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_FAIL_WITH_ERROR);
        });

        it('works with --json', async () => {
          const path = await ensureUniqueBundleIsUsed(projectWithCodeIssues);
          const { stdout, stderr, code } = await runSnykCLI(
            `code test ${path} --json`,
            {
              env: {
                ...process.env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
          expect(JSON.parse(stdout)).toMatchSchema(sarifSchema);
        });

        it('works with --sarif', async () => {
          const path = await ensureUniqueBundleIsUsed(projectWithCodeIssues);
          const { stdout, stderr, code } = await runSnykCLI(
            `code test ${path} --sarif`,
            {
              env: {
                ...process.env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
          expect(JSON.parse(stdout)).toMatchSchema(sarifSchema);
        });

        it('works with --json-file-output', async () => {
          const filePath = `${projectRoot}/not-existing/jsonOutput.json`;
          const htmlFilePath = `${projectRoot}/out.html`;
          const path = await ensureUniqueBundleIsUsed(projectWithCodeIssues);

          const { stderr, code } = await runSnykCLI(
            `code test ${path} --json-file-output=${filePath}`,
            {
              env: {
                ...process.env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);

          expect(existsSync(filePath)).toBe(true);
          expect(require(filePath)).toMatchSchema(sarifSchema);

          // execute snyk-to-html for a basic compatibility check
          const s2h = await runCommand('npx', [
            'snyk-to-html',
            `--input=${filePath}`,
            `--output=${htmlFilePath}`,
          ]);
          expect(s2h.code).toBe(0);
          expect(fs.readFileSync(htmlFilePath, 'utf8')).toContain(
            'Snyk Code Report',
          );

          // cleanup file
          try {
            unlinkSync(filePath);
            unlinkSync(htmlFilePath);
          } catch (error) {
            console.error('failed to remove file.', error);
          }
        });

        it('works with --sarif-file-output', async () => {
          const fileName = 'sarifOutput.json';
          const filePath = `${projectRoot}/${fileName}`;
          const path = await ensureUniqueBundleIsUsed(projectWithCodeIssues);
          const { stderr, code } = await runSnykCLI(
            `code test ${path} --sarif-file-output=${fileName}`,
            {
              env: {
                ...process.env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);

          expect(existsSync(filePath)).toBe(true);
          expect(require(filePath)).toMatchSchema(sarifSchema);

          // cleanup file
          try {
            unlinkSync(filePath);
          } catch (error) {
            console.error('failed to remove file.', error);
          }
        });

        it('works with human readable output', async () => {
          const path = await ensureUniqueBundleIsUsed(projectWithCodeIssues);
          const { stdout, stderr, code } = await runSnykCLI(
            `code test ${path}`,
            {
              env: {
                ...process.env,
                ...integrationEnv,
              },
            },
          );

          expect(stdout).not.toBe('');
          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
        });

        const projectWithSpaces = resolve(
          projectRoot,
          'test/fixtures/sast/folder with spaces',
        );

        it('should pass when given a folder with spaces', async () => {
          const args = ['code', 'test', projectWithSpaces];
          const { stderr, code } = await runSnykCLIWithArray(args, {
            env: {
              ...process.env,
              ...integrationEnv,
            },
          });

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_SUCCESS);
        });

        it('shows all issues when scanning a folder without repository context', async () => {
          // createProjectFromFixture creates a new project without git context
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );

          const sarifFileName = 'sarifOutput.json';
          const sarifFilePath = `${projectRoot}/${sarifFileName}`;
          const tempPath = await ensureUniqueBundleIsUsed(path());

          // Test human readable output and SARIF output
          const cliResult = await runSnykCLI(
            `code test ${tempPath} --sarif-file-output=${sarifFileName}`,
            {
              env: {
                ...process.env,
                ...integrationEnv,
              },
            },
          );

          expect(cliResult.code).toBe(EXIT_CODE_ACTION_NEEDED);
          expect(cliResult.stdout).toMatch(/✗ \[High|HIGH\]/); // Verify issues are shown

          // Verify SARIF file
          expect(existsSync(sarifFilePath)).toBe(true);
          const sarifOutput = require(sarifFilePath);
          expect(sarifOutput.runs[0].results.length).toBeGreaterThan(0);
          // Verify no suppressions exist in the results
          expect(
            sarifOutput.runs[0].results.every((result) => !result.suppressions),
          ).toBeTruthy();

          // cleanup file
          try {
            unlinkSync(sarifFilePath);
          } catch (error) {
            console.error('failed to remove file.', error);
          }
        });

        it('Stateful local code test --report', async () => {
          const args = [
            'code',
            'test',
            '--report',
            '--project-name=cicd-user-journey-test',
            await ensureUniqueBundleIsUsed(projectWithCodeIssues),
          ];
          const { stderr, code } = await runSnykCLIWithArray(args, {
            env: {
              ...process.env,
              ...integrationEnv,
            },
          });

          expect(stderr).toBe('');
          expect([EXIT_CODE_SUCCESS, EXIT_CODE_ACTION_NEEDED]).toContain(code);
        });

        it('Stateful remote code test --report', async () => {
          const args = [
            'code',
            'test',
            '--report',
            '--project-id=ff7a6ceb-fab5-4f68-bdbf-4dbc919e8074',
            '--commit-id=845449f45861a431e53298248f51e368268ef9fc',
          ];
          const { stderr, code } = await runSnykCLIWithArray(args, {
            env: {
              ...process.env,
              ...integrationEnv,
            },
          });

          expect(stderr).toBe('');
          expect([EXIT_CODE_SUCCESS, EXIT_CODE_ACTION_NEEDED]).toContain(code);
        });

        /**
         *
         * Ignore related tests
         *
         **/
        if (type === 'golang/native') {
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

          const sarifFile = `${projectRoot}/sarifOutput.json`;

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

              describe(name, () => {
                afterEach(() => {
                  // Cleanup SARIF file
                  try {
                    unlinkSync(sarifFile);
                  } catch (error) {
                    // nothing
                  }
                });

                it('with --severity-threshold', async () => {
                  const { stdout, stderr, code } = await runSnykCLI(
                    `code test ${pathToTest} --severity-threshold=high --sarif-file-output=${sarifFile}`,
                    {
                      env: {
                        ...process.env,
                        ...integrationEnv,
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
                  const sarifOutput = checkSarif(
                    sarifFile,
                    expectedIgnoredIssuesHigh,
                  );

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
                        ...process.env,
                        ...integrationEnv,
                      },
                    },
                  );

                  expect(stderr).toBe('');
                  expect(
                    stdout.toLowerCase().split('[ ignored ]').length - 1,
                  ).toBe(expectedIgnoredIssuesAll);
                  expect(code).toBe(expectedExitCode);

                  // Verify SARIF file
                  checkSarif(sarifFile, expectedIgnoredIssuesAll);
                });
              });
            },
          );

          describe(`with ignored issues`, () => {
            it('test a single file', async () => {
              const { stderr, code } = await runSnykCLI(
                `code test ${localPath}/routes/index.js --sarif-file-output=${sarifFile}`,
                {
                  env: {
                    ...process.env,
                    ...integrationEnv,
                  },
                },
              );

              expect(code).toBe(0);
              expect(stderr).toBe('');

              // Verify SARIF file
              checkSarif(sarifFile, 4);
            });
          });
        }
      });
    },
  );
});
