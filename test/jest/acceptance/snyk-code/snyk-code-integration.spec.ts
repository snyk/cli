import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { getServerPort } from '../../util/getServerPort';
import { matchers } from 'jest-json-schema';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const stripAnsi = require('strip-ansi');
const projectRoot = resolve(__dirname, '../../../..');

expect.extend(matchers);

jest.setTimeout(1000 * 120);

const EXIT_CODE_ACTION_NEEDED = 1;
const EXIT_CODE_FAIL_WITH_ERROR = 2;

describe('snyk code test', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  const port = getServerPort(process);
  const baseApi = '/v1';
  const configHome = mkdtempSync(join(tmpdir(), 'snyk-code-config-'));
  const initialEnvVars = {
    ...process.env,
    HOME: configHome,
    XDG_CONFIG_HOME: configHome,
    INTERNAL_OAUTH_TOKEN_STORAGE: '',
    SNYK_API: 'http://localhost:' + port,
    SNYK_CFG_API: '123456789',
    SNYK_HOST: 'http://localhost:' + port,
    SNYK_TOKEN: '123456789',
  };
  // expected Code Security Issues: 6 -  5 [High] 1 [Low]
  // expected Code Quality Issues: 2 -  2 [Medium]
  const projectWithCodeIssues = resolve(
    projectRoot,
    'test/fixtures/sast/with_code_issues',
  );
  beforeAll(() => {
    return new Promise<void>((resolve, reject) => {
      try {
        env = initialEnvVars;
        server = fakeServer(baseApi, '123456789');
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
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => {
        rmSync(configHome, { recursive: true, force: true });
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

  describe('integration', () => {
    const nativeEnv = {
      INTERNAL_SNYK_CODE_NATIVE_IMPLEMENTATION: 'true',
    };

    it('should show error if sast is not enabled', async () => {
      server.setOrgSetting('sast', false);

      const { code, stdout, stderr } = await runSnykCLI(
        `code test ${projectWithCodeIssues}`,
        {
          env: {
            ...env,
            ...nativeEnv,
          },
        },
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('Snyk Code is not enabled');
      expect(code).toBe(EXIT_CODE_FAIL_WITH_ERROR);
    });

    it('uses the local engine URL as the native scan base when LCE is enabled', async () => {
      const localCodeEngineUrl = fakeDeepCodeServer();
      await new Promise<void>((resolve) => localCodeEngineUrl.listen(resolve));

      try {
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
              ...nativeEnv,
              // code-client-go will panic if we don't supply the org UUID
              SNYK_CFG_ORG: '11111111-2222-3333-4444-555555555555',
            },
          },
        );

        expect(stderr).toBe('');
        expect(localCodeEngineUrl.getRequests().length).toBeGreaterThan(0);
        expect(stripAnsi(stdout)).toContain('✗ [MEDIUM]');
        expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
      } finally {
        await new Promise<void>((resolve) => localCodeEngineUrl.close(resolve));
      }
    });
  });
});
