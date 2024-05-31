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
          // Setup
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

        it('should succeed - when no vulnerabilities found', async () => {
          const sarifPayload = require('../../../fixtures/sast/empty-sarif.json');
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );

          server.setOrgSetting('sast', true);
          server.setFinding(sarifPayload);

          deepCodeServer.setFiltersResponse({
            configFiles: [],
            extensions: ['.java'],
          });
          deepCodeServer.setSarifResponse(sarifPayload);

          const { stderr, code } = await runSnykCLI(
            `code test ${path()} --remote-repo-url=something`,
            {
              env: {
                ...env,
                ...integrationEnv,
              },
            },
          );

          expect(stderr).toBe('');
          expect(code).toBe(EXIT_CODE_SUCCESS);
        });

        it('should succeed with correct exit code - with sarif output', async () => {
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
            `code test ${path()} --sarif --remote-repo-url=something`,
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

          expect(stderr).toBe('');
          expect(deepCodeServer.getRequests().length).toBe(0);
          expect(localCodeEngineUrl.getRequests().length).toBeGreaterThan(0);
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
