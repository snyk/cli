import { fakeServer, FakeServer } from '../../../acceptance/fake-server';
import { startSnykCLI, TestCLI } from '../../util/startSnykCLI';

describe('snyk-apps: create app', () => {
  let server: FakeServer;
  let cli: TestCLI | null = null;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
    const baseApi = '/rest';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_API_REST_URL: 'http://localhost:' + port + baseApi,
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
    if (cli) {
      await cli.stop();
      cli = null;
    }
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
      cli = await startSnykCLI('apps create');
      await expect(cli).toDisplay(
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
      cli = await startSnykCLI('apps invalid');
      // Check for first line to confirm help docs were indeed printed
      await expect(cli).toDisplay(
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
      cli = await startSnykCLI('apps create --interactive --experimental', {
        env,
      });
      // Assert for first question that is the name and error when no name provided
      await expect(cli).toDisplay(
        'Name of the Snyk App (visible to users when they install the Snyk App)?',
      );

      await expect(cli).not.toDisplay('Please enter something');
      await cli.answer('');
      await expect(cli).toDisplay('Please enter something');
    });

    it('should prompt for redirect uris and print error if not provided', async () => {
      cli = await startSnykCLI('apps create --interactive --experimental', {
        env,
      });

      await expect(cli).toDisplay(
        'Name of the Snyk App (visible to users when they install the Snyk App)?',
      );
      await cli.answer(testData.appName);

      // Assert if URI validator is working or not
      await expect(cli).toDisplay(
        "Your Snyk App's redirect URIs (comma seprated list.",
      );
      await cli.answer('something#invalid');
      await expect(cli).toDisplay('something#invalid is not a valid URL');
    });

    it('should prompt for scopes and print error if not provided', async () => {
      cli = await startSnykCLI('apps create --interactive --experimental', {
        env,
      });

      await expect(cli).toDisplay(
        'Name of the Snyk App (visible to users when they install the Snyk App)?',
      );
      await cli.answer(testData.appName);

      await expect(cli).toDisplay(
        "Your Snyk App's redirect URIs (comma seprated list.",
      );
      await cli.answer(testData.redirectURIs);
      // Assert
      await expect(cli).toDisplay("Your Snyk App's permission scopes");
      await cli.answer('');
      await expect(cli).toDisplay('Please enter something');
    });

    it('should prompt for org id and print error if not provided', async () => {
      cli = await startSnykCLI('apps create --interactive --experimental', {
        env,
      });

      await expect(cli).toDisplay(
        'Name of the Snyk App (visible to users when they install the Snyk App)?',
      );
      await cli.answer(testData.appName);

      await expect(cli).toDisplay(
        "Your Snyk App's redirect URIs (comma seprated list.",
      );
      await cli.answer(testData.redirectURIs);

      await expect(cli).toDisplay("Your Snyk App's permission scopes");
      await cli.answer(testData.scopes);

      // Assert
      await expect(cli).toDisplay('Please provide the org id under which');
      await cli.answer('');
      await expect(cli).toDisplay('Invalid UUID provided');
    });

    it('should create app with user provided data (interactive mode)', async () => {
      cli = await startSnykCLI('apps create --interactive --experimental', {
        env,
      });

      await expect(cli).toDisplay(
        'Name of the Snyk App (visible to users when they install the Snyk App)?',
      );
      await cli.answer(testData.appName);

      await expect(cli).toDisplay(
        "Your Snyk App's redirect URIs (comma seprated list.",
      );
      await cli.answer(testData.redirectURIs);

      await expect(cli).toDisplay("Your Snyk App's permission scopes");
      await cli.answer(testData.scopes);

      await expect(cli).toDisplay('Please provide the org id under which');
      await cli.answer(testData.orgId);

      await expect(cli).toDisplay('Which context will your app operate under');
      await cli.answer('');

      // Assert
      await expect(cli).toDisplay('Snyk App created successfully!');
      await expect(cli).toDisplay(testData.appName);
      await expect(cli).toDisplay(testData.redirectURIs);
      await expect(cli).toDisplay(testData.scopes);
      await expect(cli).toExitWith(0);
    });

    // Interactive mode with flag shortcut (-i)
    it('should prompt users for input with flag shortcut (-i)', async () => {
      cli = await startSnykCLI('apps create -i --experimental', {
        env,
      });
      // Assert for first question that is the name if presented all is working as expected
      await expect(cli).toDisplay(
        'Name of the Snyk App (visible to users when they install the Snyk App)?',
      );
    });
  });

  /**
   * Scriptable mode testing
   */
  describe('scriptable mode', () => {
    it('should throw error when org id not provided', async () => {
      cli = await startSnykCLI(
        `apps create --name=${testData.appName} --redirect-uris=${testData.redirectURIs} --scopes=${testData.scopes} --experimental`,
        { env },
      );
      // Assert
      await expect(cli).toDisplay(
        "Option '--org' is required! For interactive mode, please use '--interactive' or '-i' flag",
      );
      await expect(cli).toExitWith(2);
    });

    it('should throw error when app name not provided', async () => {
      const cli = await startSnykCLI(
        `apps create --org=${testData.orgId} --redirect-uris=${testData.redirectURIs} --scopes=${testData.scopes} --experimental`,
        { env },
      );
      // Assert
      await expect(cli).toDisplay(
        "Option '--name' is required! For interactive mode, please use '--interactive' or '-i' flag",
      );
      await expect(cli).toExitWith(2);
    });

    it('should throw error when redirect uris not provided', async () => {
      cli = await startSnykCLI(
        `apps create --org=${testData.orgId} --name=${testData.appName} --scopes=${testData.scopes} --experimental`,
        { env },
      );
      // Assert
      await expect(cli).toDisplay(
        "Option '--redirect-uris' is required! For interactive mode, please use '--interactive' or '-i' flag",
      );
      await expect(cli).toExitWith(2);
    });

    it('should throw error when scopes not provided', async () => {
      cli = await startSnykCLI(
        `apps create --org=${testData.orgId} --name=${testData.appName} --redirect-uris=${testData.redirectURIs} --experimental`,
        { env },
      );
      await expect(cli).toDisplay(
        "Option '--scopes' is required! For interactive mode, please use '--interactive' or '-i' flag",
      );
      await expect(cli).toExitWith(2);
    });

    it('throws an error when an invalid context is provided', async () => {
      cli = await startSnykCLI(
        `apps create --org=${testData.orgId} --name=${testData.appName} --redirect-uris=${testData.redirectURIs} --scopes=${testData.scopes} --context=foobar --experimental`,
        { env },
      );
      await expect(cli).toDisplay(
        "Option '--context' must be either 'tenant' or 'user'! For interactive mode, please use '--interactive' or '-i' flag. For more information please run the help command 'snyk apps --help' or 'snyk apps -h'.",
      );
      await expect(cli).toExitWith(2);
    });

    it('should create app with user provided data', async () => {
      cli = await startSnykCLI(
        `apps create --org=${testData.orgId} --name=${testData.appName} --redirect-uris=${testData.redirectURIs} --scopes=${testData.scopes} --experimental`,
        { env },
      );
      // Assert
      await expect(cli).toDisplay('Snyk App created successfully!');
      await expect(cli).toDisplay(testData.appName);
      await expect(cli).toDisplay(testData.redirectURIs);
      await expect(cli).toDisplay(testData.scopes);
      await expect(cli).toExitWith(0);
    });
  });
});
