import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { getServerPort } from '../../util/getServerPort';
const stripAnsi = require('strip-ansi');

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
  });
});
