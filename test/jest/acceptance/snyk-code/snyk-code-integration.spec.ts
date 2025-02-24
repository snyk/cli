import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { getServerPort } from '../../util/getServerPort';
import { matchers } from 'jest-json-schema';
import { resolve } from 'path';

const stripAnsi = require('strip-ansi');
const projectRoot = resolve(__dirname, '../../../..');

expect.extend(matchers);

jest.setTimeout(1000 * 120);

interface Workflow {
  type: string;
  env: { [key: string]: string | undefined };
}

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

  beforeAll(() => {
    return new Promise<void>((resolve, reject) => {
      try {
        deepCodeServer = fakeDeepCodeServer();
        deepCodeServer.listen(() => {
          // Add any necessary setup code here
        });
        env = {
          ...initialEnvVars,
          SNYK_CODE_CLIENT_PROXY_URL: `http://localhost:${deepCodeServer.getPort()}`,
        };
        server = fakeServer(baseApi, 'snykToken');
        server.listen(port, () => {
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  });

  afterEach(() => {
    server.restore();
    deepCodeServer.restore();
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      deepCodeServer.close(() => {
        // Add any necessary cleanup code here
      });
      server.close(() => {
        resolve();
      });
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
          expect(stdout).toContain('Snyk Code is not enabled');
          expect(code).toBe(EXIT_CODE_FAIL_WITH_ERROR);
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
});
