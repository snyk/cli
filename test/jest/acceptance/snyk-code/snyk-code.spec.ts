import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { getServerPort } from '../../util/getServerPort';
import { matchers } from 'jest-json-schema';

const stripAnsi = require('strip-ansi');

expect.extend(matchers);

const EXIT_CODE_ACTION_NEEDED = 1;
const EXIT_CODE_FAIL_WITH_ERROR = 2;

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
    // {
    //   type: 'legacy',
    //   env: {},
    // },
    {
      type: 'native',
      env: {
        // internal GAF feature flag for consistent ignores
        INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'true',
      },
    },
  ];

  describe.each(integrationWorkflows)(
    'integration',
    ({ type, env: integrationEnv }) => {
      describe(`${type} workflow`, () => {
        it.only('should show error if sast is not enabled', async () => {
          // Setup
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );
          server.setOrgSetting('sast', false);

          const { stdout, code, stderr } = await runSnykCLI(
            `code test ${path()} -d`,
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

        it('succeed testing with correct exit code - with sarif oputput and no markdown', async () => {
          const sarifPayload = require('../../../fixtures/sast/sample-sarif.json');
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );
          server.setOrgSetting('sast', true);
          deepCodeServer.setSarifResponse(sarifPayload);

          const { stdout, stderr, code } = await runSnykCLI(
            `code test ${path()} --sarif --no-markdown`,
            {
              env: {
                ...env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          const output = JSON.parse(stdout);
          expect(Object.keys(output.runs[0].results[0].message)).not.toContain(
            'markdown',
          );
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
        });

        const failedCodeTestMessage = "Failed to run 'code test'";

        // This is caused by the retry logic in the code-client
        // which defaults to 10 retries with a 5 second delay
        jest.setTimeout(60000);
        it.each([
          [{ code: 401 }, `Unauthorized: ${failedCodeTestMessage}`],
          [{ code: 429 }, failedCodeTestMessage],
          // [{ code: 500 }, failedCodeTestMessage], // TODO this causes the test to hang. Think it is due to retry logic
        ])(
          'should fail - when server returns %p',
          async (errorCodeObj, expectedResult) => {
            const { path } = await createProjectFromFixture(
              'sast/shallow_sast_webgoat',
            );
            server.setOrgSetting('sast', true);
            deepCodeServer.setNextStatusCode(errorCodeObj.code);
            deepCodeServer.setNextResponse({
              statusCode: errorCodeObj.code,
              statusText: 'Unauthorized action',
              apiName: 'code',
            });

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
            expect(stdout).toContain(expectedResult);
            expect(code).toBe(EXIT_CODE_FAIL_WITH_ERROR);
          },
        );

        it("use remote LCE's url as base when LCE is enabled", async () => {
          const localCodeEngineUrl = fakeDeepCodeServer();
          localCodeEngineUrl.listen(() => {});

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

          expect(deepCodeServer.getRequests().length).toBe(0);
          expect(localCodeEngineUrl.getRequests().length).toBeGreaterThan(0);
          expect(stderr).toBe('');
          expect(stripAnsi(stdout)).toContain(
            '✗ [Medium] Information Exposure',
          );
          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);

          await localCodeEngineUrl.close(() => {});
        });
      });
    },
  );
});
