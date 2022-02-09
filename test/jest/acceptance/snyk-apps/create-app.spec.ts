import { runSnykCLI, runSnykCLIWithUserInputs } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';

// const DOWN = '\x1B\x5B\x42';
// const UP = '\x1B\x5B\x41';
const ENTER = '\x0D';
// const SPACE = '\x20';

describe('snyk-apps: create app', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
    const baseApi = '/v3';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_API_V3_URL: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(async () => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  const orgId = '4e0828f9-d92a-4f54-b005-6b9d8150b75f';
  const testData = {
    appName: 'Test',
    redirectURIs: 'https://example.com,https://example1.com',
    scopes: 'org.read',
    orgId,
  };

  /**
   * Test experimental feature flag functionality
   */
  describe('experimental flag', () => {
    it('should throw error without the experimental flag', async () => {
      const { stdout } = await runSnykCLI('apps create');
      expect(stdout).toContain(
        `All 'apps' commands are only accessible behind the '--experimental' flag.`,
      );
    });
  });

  /**
   * Help command validation when invalid apps subcommand called
   * TODO: breakdown test blocks to different file when more
   * are added
   */
  describe('help', () => {
    it('should print the apps helps document when apps subcommand invalid', async () => {
      const { stdout } = await runSnykCLI('apps invalid');
      // Check for first line to confirm help docs were indeed printed
      // Snapshot testing can lead to flaky test due to varying screen width
      expect(stdout).toContain(
        'Snyk Apps are integrations that extend the functionality of the Snyk platform',
      );
    });
  });
  /**
   * Tests for the interactive mode of the command to create apps.
   * Using Jest snapshot testing led to very flaky behaviour.
   * Suspected due to changing screen width
   */
  describe('interactive mode', () => {
    it('should prompt for app name and print error if not provided', async () => {
      const { stdout } = await runSnykCLIWithUserInputs(
        'apps create --interactive --experimental',
        [ENTER],
        {
          env,
        },
      );
      // Assert for first question that is the name and error when no name provided
      expect(stdout).toContain(
        'Name of the Snyk App (visible to users when they install the Snyk App)?',
      );
      expect(stdout).toContain('Please enter something');
    });

    it('should prompt for redirect uris and print error if not provided', async () => {
      const { stdout } = await runSnykCLIWithUserInputs(
        'apps create --interactive --experimental',
        [testData.appName, ENTER, 'something#invalid', ENTER],
        {
          env,
        },
      );
      // Assert if URI validator is working or not
      expect(stdout).toContain(
        "Your Snyk App's redirect URIs (comma seprated list.",
      );
      expect(stdout).toContain('something#invalid is not a valid URL');
    });

    it('should prompt for scopes and print error if not provided', async () => {
      const { stdout } = await runSnykCLIWithUserInputs(
        'apps create --interactive --experimental',
        [testData.appName, ENTER, testData.redirectURIs, ENTER, ENTER],
        { env },
      );
      // Assert
      expect(stdout).toContain("Your Snyk App's permission scopes");
      expect(stdout).toContain('Please enter something');
    });

    it('should prompt for org id and use default if not provided', async () => {
      const { stdout } = await runSnykCLIWithUserInputs(
        'apps create --interactive --experimental',
        [
          testData.appName,
          ENTER,
          testData.redirectURIs,
          ENTER,
          testData.scopes,
          ENTER,
          ENTER,
        ],
        { env },
      );
      // Assert
      expect(stdout).toContain('Please provide the org id under which');
    });

    it('should create app with user provided data (interactive mode)', async () => {
      const { stdout, code } = await runSnykCLIWithUserInputs(
        'apps create --interactive --experimental',
        [
          testData.appName,
          ENTER,
          testData.redirectURIs,
          ENTER,
          testData.scopes,
          ENTER,
          testData.orgId,
          ENTER,
        ],
        { env },
      );
      // Assert
      expect(code).toBe(0);
      expect(stdout).toContain('Snyk App created successfully!');
      expect(stdout).toContain(`${testData.appName}`);
      expect(stdout).toContain(`${testData.redirectURIs}`);
      expect(stdout).toContain(`${testData.scopes}`);
    });

    // Interactive mode with flag shortcut (-i)
    it('should prompt users for input with flag shortcut (-i)', async () => {
      const { stdout } = await runSnykCLIWithUserInputs(
        'apps create -i --experimental',
        [ENTER],
        {
          env,
        },
      );
      // Assert for first question that is the name if presented all is working as expected
      expect(stdout).toContain(
        'Name of the Snyk App (visible to users when they install the Snyk App)?',
      );
    });
  });

  /**
   * Scriptable mode testing
   */
  describe('scriptable mode', () => {
    it('should throw error when org id not provided', async () => {
      const { code, stdout } = await runSnykCLI(
        `apps create --name=${testData.appName} --redirect-uris=${testData.redirectURIs} --scopes=${testData.scopes} --experimental`,
        { env },
      );
      // Assert
      expect(code).toBe(2);
      expect(stdout).toContain(
        "Option '--org' is required! For interactive mode, please use '--interactive' or '-i' flag",
      );
    });

    it('should throw error when app name not provided', async () => {
      const { code, stdout } = await runSnykCLI(
        `apps create --org=${testData.orgId} --redirect-uris=${testData.redirectURIs} --scopes=${testData.scopes} --experimental`,
        { env },
      );
      // Assert
      expect(code).toBe(2);
      expect(stdout).toContain(
        "Option '--name' is required! For interactive mode, please use '--interactive' or '-i' flag",
      );
    });

    it('should throw error when redirect uris not provided', async () => {
      const { code, stdout } = await runSnykCLI(
        `apps create --org=${testData.orgId} --name=${testData.appName} --scopes=${testData.scopes} --experimental`,
        { env },
      );
      // Assert
      expect(code).toBe(2);
      expect(stdout).toContain(
        "Option '--redirect-uris' is required! For interactive mode, please use '--interactive' or '-i' flag",
      );
    });

    it('shoud throw error when scopes not provided', async () => {
      const { code, stdout } = await runSnykCLI(
        `apps create --org=${testData.orgId} --name=${testData.appName} --redirect-uris=${testData.redirectURIs} --experimental`,
        { env },
      );
      expect(code).toBe(2);
      expect(stdout).toContain(
        "Option '--scopes' is required! For interactive mode, please use '--interactive' or '-i' flag",
      );
    });

    it('should create app with user provided data', async () => {
      const { code, stdout } = await runSnykCLI(
        `apps create --org=${testData.orgId} --name=${testData.appName} --redirect-uris=${testData.redirectURIs} --scopes=${testData.scopes} --experimental`,
        { env },
      );
      // Assert
      expect(code).toBe(0);
      expect(stdout).toContain('Snyk App created successfully!');
      expect(stdout).toContain(`${testData.appName}`);
      expect(stdout).toContain(`${testData.redirectURIs}`);
      expect(stdout).toContain(`${testData.scopes}`);
    });
  });
});
