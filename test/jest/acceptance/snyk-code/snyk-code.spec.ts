import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { getServerPort } from '../../util/getServerPort';
import { matchers } from 'jest-json-schema';

const stripAnsi = require('strip-ansi');

expect.extend(matchers);

const SARIF_SCHEMA = require('../../../fixtures/code/snyk-code-sarif-output-schema.json');
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_ACTION_NEEDED = 1;
const EXIT_CODE_FAIL_WITH_ERROR = 2;
const EXIT_CODE_NO_SUPPORTED_FILES = 3;

describe('code', () => {
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

  describe('test', () => {
    it('should fail - when we do not support files', async () => {
      // Setup
      const { path } = await createProjectFromFixture('empty');
      server.setOrgSetting('sast', true);

      const { stdout, code, stderr } = await runSnykCLI(`code test ${path()}`, {
        env,
      });

      expect(stderr).toBe('');
      expect(stdout).toContain(`We found 0 supported files`);
      expect(code).toBe(EXIT_CODE_NO_SUPPORTED_FILES); // failure, no supported projects detected
    });

    it('should succeed - when no errors found', async () => {
      // Setup
      const { path } = await createProjectFromFixture(
        'sast-empty/shallow_empty',
      );
      server.setOrgSetting('sast', true);
      deepCodeServer.setSarifResponse(
        require('../../../fixtures/sast-empty/empty-sarif.json'),
      );

      const { stdout, code, stderr } = await runSnykCLI(`code test ${path()}`, {
        env,
      });

      expect(stderr).toBe('');
      expect(stdout).toContain(`Awesome! No issues were found.`);
      expect(code).toBe(EXIT_CODE_SUCCESS);

      expect(
        server
          .getRequests()
          .filter((req) => req.originalUrl.endsWith('/analytics/cli')),
      ).toHaveLength(2);
    });

    it('should succeed - with correct exit code', async () => {
      const { path } = await createProjectFromFixture(
        'sast/shallow_sast_webgoat',
      );
      server.setOrgSetting('sast', true);
      deepCodeServer.setSarifResponse(
        require('../../../fixtures/sast/sample-sarif.json'),
      );

      const { stdout, stderr, code } = await runSnykCLI(`code test ${path()}`, {
        env,
      });

      // We do not render the help message for unknown flags
      expect(stderr).toBe('');
      expect(stripAnsi(stdout)).toContain('✗ [Medium] Information Exposure');
      expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
    });

    it('should show error if sast is not enabled', async () => {
      // Setup
      const { path } = await createProjectFromFixture(
        'sast/shallow_sast_webgoat',
      );
      server.setOrgSetting('sast', false);

      const { stdout, code, stderr } = await runSnykCLI(`code test ${path()}`, {
        env,
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('Snyk Code is not supported for org');
      expect(code).toBe(EXIT_CODE_FAIL_WITH_ERROR);
    });

    it.each([['sarif'], ['json']])(
      'succeed testing with correct exit code - with %p output',
      async (optionsName) => {
        const sarifPayload = require('../../../fixtures/sast/sample-sarif.json');
        const { path } = await createProjectFromFixture(
          'sast/shallow_sast_webgoat',
        );
        server.setOrgSetting('sast', true);
        deepCodeServer.setSarifResponse(sarifPayload);

        const { stdout, stderr, code } = await runSnykCLI(
          `code test ${path()} --${optionsName}`,
          {
            env,
          },
        );

        expect(stderr).toBe('');
        expect(JSON.parse(stdout)).toEqual(sarifPayload);
        expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
      },
    );

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
          env,
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
      [{ code: 500 }, failedCodeTestMessage], // TODO this causes the test to hang. Think it is due to retry logic
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
            env,
          },
        );

        expect(stderr).toBe('');
        expect(stdout).toContain(expectedResult);
        expect(code).toBe(EXIT_CODE_FAIL_WITH_ERROR);
      },
    );

    it("use remote LCE's url as base when LCE is enabled", async () => {
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

      const { stdout, code, stderr } = await runSnykCLI(`code test ${path()}`, {
        env,
      });

      expect(deepCodeServer.getRequests().length).toBe(0);
      expect(localCodeEngineUrl.getRequests().length).toBeGreaterThan(0);
      expect(stderr).toBe('');
      expect(stripAnsi(stdout)).toContain('✗ [Medium] Information Exposure');
      expect(code).toBe(EXIT_CODE_ACTION_NEEDED);

      await localCodeEngineUrl.close(() => { });
    });

    // TODO: unskip once Go based snyk code is implemented
    describe.skip('native workflow', () => {
      // setup required params to trigger native workflow
      const nativeWorkflowEnvVars = {
        // internal GAF feature flag for consistent ignores
        INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'true',
      };

      it('should succeed - when no errors found', async () => {
        const { path } = await createProjectFromFixture(
          'sast-empty/shallow_empty',
        );

        const { stdout, code, stderr } = await runSnykCLI(`code test ${path()}`, {
          env: {
            ...process.env,
            ...nativeWorkflowEnvVars,
          },
        });

        if (stderr) console.log('STDERR: ', stderr);

        expect(stderr).toBe('');
        expect(stdout).toContain(`Awesome! No issues were found.`);
        expect(code).toBe(EXIT_CODE_SUCCESS);
      });

      it('should succeed - with correct exit code', async () => {
        const { path } = await createProjectFromFixture(
          'sast/shallow_sast_webgoat',
        );

        const { stdout, stderr, code } = await runSnykCLI(`code test ${path()}`, {
          env: {
            ...process.env,
            ...nativeWorkflowEnvVars,
          },
        });

        if (stderr) console.log('STDERR: ', stderr);

        // We do not render the help message for unknown flags
        expect(stderr).toBe('');
        expect(stripAnsi(stdout)).toContain('✗ [Medium] Information Exposure');
        expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
      });

      it.each([['sarif'], ['json']])(
        '--%s output should match sarif schema',
        async (option) => {
          const { path } = await createProjectFromFixture(
            'sast/shallow_sast_webgoat',
          );

          const { stdout, stderr, code } = await runSnykCLI(
            `code test ${path()} --${option}`,
            {
              env: {
                ...process.env,
                ...nativeWorkflowEnvVars,
              },
            },
          );

          if (stderr) console.log('STDERR: ', stderr);

          expect(code).toBe(EXIT_CODE_ACTION_NEEDED);

          const jsonOutput = JSON.parse(stdout);
          expect(jsonOutput).toMatchSchema(SARIF_SCHEMA);
        },
      );
    });
  });
});
