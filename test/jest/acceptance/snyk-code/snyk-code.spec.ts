/**
 *
 * - Remove instances of `--remote-repo-url=something`
 */
import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { getServerPort } from '../../util/getServerPort';
import { matchers } from 'jest-json-schema';

const stripAnsi = require('strip-ansi');

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
  beforeAll((done) => {
    deepCodeServer = fakeDeepCodeServer();
    deepCodeServer.listen(() => { });
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
    deepCodeServer.close(() => { });
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
    // {
    //   type: 'typescript',
    //   env: {
    //     INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'false',
    //   },
    // },
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
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );
          server.setOrgSetting('sast', false);

          const { stdout, code, stderr } = await runSnykCLI(
            `code test ${path()}`,
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

        it.only('should succeed with correct exit code - with sarif output', async () => {
          const sarifPayload = require('../../../fixtures/sast/sample-sarif.json');
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );
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

          const { stderr, code } = await runSnykCLI(
            `code test ${path()} --sarif -d`,
            {
              env: {
                ...env,
                ...integrationEnv,
                // code-client-go will panic if we don't supply the org UUID
                SNYK_CFG_ORG: '11111111-2222-3333-4444-555555555555',
              },
            },
          );
          console.log('****', 'stderr ****\n', stderr, '\n');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
          // expect(stderr).toBe('');
        });

        it('should succeed with correct exit code - with json output', async () => {
          const sarifPayload = require('../../../fixtures/sast/sample-sarif.json');
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );
          server.setOrgSetting('sast', true);
          deepCodeServer.setFiltersResponse({
            configFiles: [],
            extensions: ['.java'],
          });
          deepCodeServer.setSarifResponse(sarifPayload);

          const { stderr, code } = await runSnykCLI(
            `code test ${path()} --json`,
            {
              env: {
                ...env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
        });

        it('should succeed with correct exit code - normal output', async () => {
          const sarifPayload = require('../../../fixtures/sast/sample-sarif.json');
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );
          server.setOrgSetting('sast', true);
          deepCodeServer.setFiltersResponse({
            configFiles: [],
            extensions: ['.java'],
          });

          deepCodeServer.setSarifResponse(sarifPayload);

          const { stderr, code } = await runSnykCLI(
            `code test ${path()}`,
            {
              env: {
                ...env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
        });

        it('should fail with correct exit code - when testing empty project', async () => {
          const sarifPayload = require('../../../fixtures/sast/sample-sarif.json');
          const { path } = await createProjectFromFixture(
            'sast/unsupported-files',
          );
          server.setOrgSetting('sast', true);
          deepCodeServer.setSarifResponse(sarifPayload);

          const { code } = await runSnykCLI(`code test ${path()}`, {
            env: {
              ...env,
              ...integrationEnv,
            },
          });

          expect(code).toBe(EXIT_CODE_NO_SUPPORTED_FILES);
        });

        // TODO: reenable this test for golang/native when SNYK_CODE_CLIENT_PROXY_URL is supported
        const itif = (condition) => condition ? it : it.skip;
        // console.warn('Skipping test for "golang/native" implementation until this feature is supported.')
        itif(type === 'typescript')('should support the SNYK_CODE_CLIENT_PROXY_URL env var', async () => {
          const sarifPayload = require('../../../fixtures/sast/sample-sarif.json');
          const { path } = await createProjectFromFixture(
            'sast/unsupported-files',
          );
          server.setOrgSetting('sast', true);
          deepCodeServer.setSarifResponse(sarifPayload);

          const { code } = await runSnykCLI(`code test ${path()} -d`, {
            env: {
              ...env,
              ...integrationEnv,
            },
          });

          expect(code).toEqual(EXIT_CODE_NO_SUPPORTED_FILES);

          const request = deepCodeServer
            .getRequests()
            .filter((value) =>
              (value.url as string).includes(`/filters`),
            )
            .pop();

          expect(request).toBeDefined();
        });

        it('use remote LCE URL as base when LCE is enabled', async () => {
          const localCodeEngineUrl = fakeDeepCodeServer();
          localCodeEngineUrl.listen(() => { });

          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );
          server.setOrgSetting('sast', true);
          server.setLocalCodeEngineConfiguration({
            enabled: true,
            allowCloudUpload: true,
            url: 'http://localhost:' + localCodeEngineUrl.getPort(),
          });
          localCodeEngineUrl.setSarifResponse(
            require('../../../fixtures/sast/sample-sarif.json'),
          );

          const { stdout, code, stderr } = await runSnykCLI(
            `code test ${path()}`,
            {
              env: {
                ...env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(deepCodeServer.getRequests().length).toBe(0);
          expect(localCodeEngineUrl.getRequests().length).toBeGreaterThan(0);
          expect(stripAnsi(stdout)).toContain(
            '✗ [Medium] Information Exposure',
          );
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);

          await localCodeEngineUrl.close(() => { });
        });
      });
    },
  );

  const userJourneyWorkflows: Workflow[] = [
    {
      type: 'typescript',
      env: {
        INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'false',
      },
    },
    // {
    //   type: 'golang/native',
    //   env: {
    //     // internal GAF feature flag for consistent ignores
    //     INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'true',
    //     // TODO: stop using dev env once consistent ignores is GA
    //     SNYK_API: 'https://api.dev.snyk.io',
    //     // TODO: determine valid token for api.dev.snyk.io
    //     // SNYK_TOKEN: process.env.SOME_TOKEN
    //   },
    // },
  ];

  describe.each(userJourneyWorkflows)(
    'user journey',
    ({ type, env: integrationEnv }) => {
      describe(`${type} workflow`, () => {
        jest.setTimeout(60000);
        it('should succeed - when no vulnerabilities found', async () => {
          const { path } = await createProjectFromFixture(
            'sast/no-vulnerabilities',
          );

          const { stderr, code } = await runSnykCLI(
            `code test ${path()}`,
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

        it('should succeed with correct exit code', async () => {
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );

          const { stderr, code } = await runSnykCLI(
            `code test ${path()}`,
            {
              env: {
                ...process.env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
        });

        it('should fail with correct exit code - when testing empty project', async () => {
          const { path } = await createProjectFromFixture(
            'sast/unsupported-files',
          );

          const { stderr, code } = await runSnykCLI(
            `code test ${path()}`,
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
          const { path } = await createProjectFromFixture(
            'sast/unsupported-files',
          );

          const { stderr, code } = await runSnykCLI(
            `code test ${path()}`,
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
      });
    },
  );
});
