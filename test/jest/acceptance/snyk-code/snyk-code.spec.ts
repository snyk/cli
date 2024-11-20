import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { getServerPort } from '../../util/getServerPort';
import { matchers } from 'jest-json-schema';
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';

const stripAnsi = require('strip-ansi');
const projectRoot = resolve(__dirname, '../../../..');

const sarifSchema = require('../../../schemas/sarif-schema-2.1.0.json');

expect.extend(matchers);

const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_ACTION_NEEDED = 1;
const EXIT_CODE_FAIL_WITH_ERROR = 2;
const EXIT_CODE_NO_SUPPORTED_FILES = 3;

describe('snyk code test', () => {
  let server: ReturnType<typeof fakeServer>;
  let deepCodeServer: ReturnType<typeof fakeDeepCodeServer>;
  let env: Record<string, string>;
  const port = getServerPort(process);
  const baseApi = '/api/v1';
  const initialEnvVars = {
    ...process.env,
    SNYK_API: 'http://localhost:' + port + baseApi,
    SNYK_HOST: 'http://localhost:' + port,
    SNYK_TOKEN: '123456789',
  };
  // expected Code Security Issues: 6 -  5 [High] 1 [Low]
  // expected Code Quality Issues: 2 -  2 [Medium]
  const projectWithCodeIssues = resolve(
    projectRoot,
    'test/fixtures/sast/with_code_issues',
  );
  const emptyProject = resolve(projectRoot, 'test/fixtures/empty');

  beforeAll((done) => {
    deepCodeServer = fakeDeepCodeServer();
    deepCodeServer.listen(() => {});
    env = {
      ...initialEnvVars,
      SNYK_CODE_CLIENT_PROXY_URL: `http://localhost:${deepCodeServer.getPort()}`,
    };
    server = fakeServer(baseApi, 'snykToken');
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
    deepCodeServer.restore();
  });

  afterAll((done) => {
    deepCodeServer.close(() => {});
    server.close(() => {
      done();
    });
  });

  it('prints help info', async () => {
    const { stdout, code, stderr } = await runSnykCLI('code', { env });

    expect(stripAnsi(stdout)).toContain(
      'The snyk code test command finds security issues using Static Code Analysis.',
    );
    expect(code).toBe(0);
    expect(stderr).toBe('');
  });

  interface Workflow {
    type: string;
    env: { [key: string]: string | undefined };
  }

  const integrationWorkflows: Workflow[] = [
    {
      type: 'typescript',
      env: {
        INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'false',
      },
    },
    {
      type: 'golang/native',
      env: {
        // internal GAF feature flag for consistent ignores
        INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'true',
      },
    },
  ];

  describe.each(integrationWorkflows)(
    `integration`,
    ({ type, env: integrationEnv }) => {
      describe(`${type} workflow`, () => {
        it('should show error if sast is not enabled', async () => {
          server.setOrgSetting('sast', false);

          const { code, stdout, stderr } = await runSnykCLI(
            `code test ${projectWithCodeIssues}`,
            {
              env: {
                ...env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(stdout).toContain('Snyk Code is not supported for org');
          expect(code).toBe(EXIT_CODE_FAIL_WITH_ERROR);
        });

        it('should succeed with correct exit code - with sarif output', async () => {
          const sarifPayload = require('./fixtures/test-sarif.json');
          server.setOrgSetting('sast', true);
          deepCodeServer.setCustomResponse({
            configFiles: [],
            extensions: ['.java'],
          });
          deepCodeServer.setSarifResponse(sarifPayload);

          // code-client-go abstracts deeproxy calls, so fake-server needs these endpoints
          server.setCustomResponse({
            configFiles: [],
            extensions: ['.java'],
          });

          server.setSarifResponse(sarifPayload);

          const { stderr, code } = await runSnykCLI(
            `code test ${projectWithCodeIssues} --sarif`,
            {
              env: {
                ...env,
                ...integrationEnv,
                // code-client-go will panic if we don't supply the org UUID
                SNYK_CFG_ORG: '11111111-2222-3333-4444-555555555555',
              },
            },
          );

          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
          expect(stderr).toBe('');
        });

        it('should succeed with correct exit code - with json output', async () => {
          const sarifPayload = require('./fixtures/test-sarif.json');
          server.setOrgSetting('sast', true);
          deepCodeServer.setFiltersResponse({
            configFiles: [],
            extensions: ['.java'],
          });
          deepCodeServer.setSarifResponse(sarifPayload);

          // code-client-go abstracts deeproxy calls, so fake-server needs these endpoints
          server.setCustomResponse({
            configFiles: [],
            extensions: ['.java'],
          });
          server.setSarifResponse(sarifPayload);

          const { stderr, code } = await runSnykCLI(
            `code test ${projectWithCodeIssues} --json`,
            {
              env: {
                ...env,
                ...integrationEnv,
                // code-client-go will panic if we don't supply the org UUID
                SNYK_CFG_ORG: '11111111-2222-3333-4444-555555555555',
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
        });

        it('should succeed with correct exit code - normal output', async () => {
          const sarifPayload = require('./fixtures/test-sarif.json');
          server.setOrgSetting('sast', true);
          deepCodeServer.setFiltersResponse({
            configFiles: [],
            extensions: ['.java'],
          });

          deepCodeServer.setSarifResponse(sarifPayload);

          // code-client-go abstracts deeproxy calls, so fake-server needs these endpoints
          server.setCustomResponse({
            configFiles: [],
            extensions: ['.java'],
          });
          server.setSarifResponse(sarifPayload);

          const { stderr, code } = await runSnykCLI(
            `code test ${projectWithCodeIssues}`,
            {
              env: {
                ...env,
                ...integrationEnv,
                // code-client-go will panic if we don't supply the org UUID
                SNYK_CFG_ORG: '11111111-2222-3333-4444-555555555555',
              },
            },
          );
          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
        });

        it('should fail with correct exit code - when testing empty project', async () => {
          const sarifPayload = require('../../../fixtures/sast/sample-sarif.json');
          server.setOrgSetting('sast', true);
          deepCodeServer.setSarifResponse(sarifPayload);

          const { code } = await runSnykCLI(`code test ${emptyProject}`, {
            env: {
              ...env,
              ...integrationEnv,
            },
          });

          expect(code).toBe(EXIT_CODE_NO_SUPPORTED_FILES);
        });

        // TODO: reenable tests for golang/native when SNYK_CODE_CLIENT_PROXY_URL && LCE are supported
        if (type === 'typescript') {
          it('should support the SNYK_CODE_CLIENT_PROXY_URL env var', async () => {
            const sarifPayload = require('../../../fixtures/sast/sample-sarif.json');
            server.setOrgSetting('sast', true);
            deepCodeServer.setSarifResponse(sarifPayload);

            const { code } = await runSnykCLI(`code test ${emptyProject}`, {
              env: {
                ...env,
                ...integrationEnv,
              },
            });

            expect(code).toEqual(EXIT_CODE_NO_SUPPORTED_FILES);

            const request = deepCodeServer
              .getRequests()
              .filter((value) => (value.url as string).includes(`/filters`))
              .pop();

            expect(request).toBeDefined();
          });

          it('use remote LCE URL as base when LCE is enabled', async () => {
            const localCodeEngineUrl = fakeDeepCodeServer();
            localCodeEngineUrl.listen(() => {});

            server.setOrgSetting('sast', true);
            server.setLocalCodeEngineConfiguration({
              enabled: true,
              allowCloudUpload: true,
              url: 'http://localhost:' + localCodeEngineUrl.getPort(),
            });

            localCodeEngineUrl.setSarifResponse(
              require('../../../fixtures/sast/sample-sarif.json'),
            );

            // code-client-go abstracts deeproxy calls, so fake-server needs these endpoints
            server.setCustomResponse({
              configFiles: [],
              extensions: ['.java'],
            });

            const { stdout, code, stderr } = await runSnykCLI(
              `code test ${projectWithCodeIssues}`,
              {
                env: {
                  ...env,
                  ...integrationEnv,
                  // code-client-go will panic if we don't supply the org UUID
                  SNYK_CFG_ORG: '11111111-2222-3333-4444-555555555555',
                },
              },
            );

            expect(stderr).toBe('');
            expect(deepCodeServer.getRequests().length).toBe(0);
            expect(localCodeEngineUrl.getRequests().length).toBeGreaterThan(0);
            expect(stripAnsi(stdout)).toContain('✗ [Medium]');
            expect(code).toBe(EXIT_CODE_ACTION_NEEDED);

            localCodeEngineUrl.close(() => {});
          });
        }
      });
    },
  );

  const userJourneyWorkflows: Workflow[] = [
    {
      type: 'typescript',
      env: {
        // force use of legacy implementation
        INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'false',
      },
    },
    {
      type: 'golang/native',
      env: {
        // Use an org with consistent ignores enabled - uses golang/native workflow
        SNYK_API: process.env.TEST_SNYK_API_DEV,
        SNYK_TOKEN: process.env.TEST_SNYK_TOKEN_DEV,
      },
    },
  ];

  describe.each(userJourneyWorkflows)(
    'user journey',
    ({ type, env: integrationEnv }) => {
      describe(`${type} workflow`, () => {
        jest.setTimeout(60000);

        describe('snyk code flag options', () => {
          it('works with --remote-repo-url', async () => {
            const expectedCodeSecurityIssues = 6;
            const { stdout } = await runSnykCLI(
              `code test ${projectWithCodeIssues} --remote-repo-url=hhttps://github.com/snyk/cli.git --json`,
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

          // TODO: reenable when fixed in CLI-397, CLI-436
          if (type === 'typescript') {
            it('works with --severity-threshold', async () => {
              const expectedHighCodeSecurityIssues = 5;
              const { stdout } = await runSnykCLI(
                `code test ${projectWithCodeIssues} --json --severity-threshold=high`,
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

            it('works with --org', async () => {
              const MADE_UP_ORG_WITH_NO_SNYK_CODE_PERMISSIONS =
                'madeUpOrgWithNoSnykCodePermissions';

              const { stdout, code } = await runSnykCLI(
                `code test ${projectWithCodeIssues} --org=${MADE_UP_ORG_WITH_NO_SNYK_CODE_PERMISSIONS}`,
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

        // TODO: reenable for golang/native when it supports no git context
        if (type === 'typescript') {
          it('works on projects with no git context', async () => {
            // createProjectFromFixture creates a new project without gitcontext
            const { path } = await createProjectFromFixture(
              'sast/shallow_sast_webgoat',
            );

            const { stderr, code } = await runSnykCLI(`code test ${path()}`, {
              env: {
                ...process.env,
                ...integrationEnv,
              },
            });

            expect(stderr).toBe('');
            expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
          });
        }

        it('should succeed - when no vulnerabilities found', async () => {
          const noVulnsProject = resolve(
            projectRoot,
            'test/fixtures/sast/no-vulnerabilities',
          );

          const { stderr, code } = await runSnykCLI(
            `code test ${noVulnsProject}`,
            {
              env: {
                ...process.env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_SUCCESS);
        });

        it('should not include code quality issues in results', async () => {
          // expected Code Quality Issues: 2 -  2 [Medium]
          const expectedCodeSecurityIssues = 6;
          const { stdout } = await runSnykCLI(
            `code test ${projectWithCodeIssues} --json`,
            {
              env: {
                ...process.env,
                ...integrationEnv,
              },
            },
          );

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
          const { stdout, stderr, code } = await runSnykCLI(
            `code test ${projectWithCodeIssues} --json`,
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
          const { stdout, stderr, code } = await runSnykCLI(
            `code test ${projectWithCodeIssues} --sarif`,
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
          const fileName = 'jsonOutput.json';
          const filePath = `${projectRoot}/${fileName}`;
          const { stderr, code } = await runSnykCLI(
            `code test ${projectWithCodeIssues} --json-file-output=${fileName}`,
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

        it('works with --sarif-file-output', async () => {
          const fileName = 'sarifOutput.json';
          const filePath = `${projectRoot}/${fileName}`;
          const { stderr, code } = await runSnykCLI(
            `code test ${projectWithCodeIssues} --sarif-file-output=${fileName}`,
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
      });
    },
  );
});
