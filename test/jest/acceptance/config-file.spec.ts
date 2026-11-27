import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getAvailableServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 60);

/**
 * User journey: a snyk.json in the working directory, for example one committed to a repository, is never read. A user
 * who wants a configuration file other than the one in the configstore directory names it with SNYK_CONFIG_FILE.
 */
describe('configuration file', () => {
  const pinnedToken = '33333333-3333-4333-8333-333333333333';
  const repositoryToken = '44444444-4444-4444-8444-444444444444';
  const envToken = '66666666-6666-4666-8666-666666666666';

  let server: ReturnType<typeof fakeServer>;
  let endpoint: string;
  let home: string;
  let workingDir: string;

  const cleanEnvironment = (): Record<string, string | undefined> =>
    Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => !/^(snyk_|internal_|test_snyk)/i.test(name),
      ),
    );

  const snyk = (args: string, env: Record<string, string | undefined> = {}) =>
    runSnykCLI(args, {
      cwd: workingDir,
      env: {
        ...cleanEnvironment(),
        HOME: home,
        USERPROFILE: home,
        SNYK_DISABLE_ANALYTICS: '1',
        // the fake server speaks plain HTTP
        SNYK_HTTP_PROTOCOL_UPGRADE: '0',
        ...env,
      },
    });

  const whoami = (env: Record<string, string | undefined> = {}) =>
    snyk('whoami --experimental', env);

  /** The distinct tokens the server saw on user requests since the last restore. */
  const tokensUsed = (): string[] => [
    ...new Set(
      server
        .getRequests()
        .filter((request) => request.url.startsWith('/rest/self'))
        .map((request) => String(request.headers.authorization)),
    ),
  ];

  const writeConfig = (file: string, token: string) =>
    fs.writeFileSync(file, JSON.stringify({ api: token, endpoint }));

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    server = fakeServer('/api/v1', pinnedToken);
    await server.listenPromise(port);
    endpoint = `http://${getFirstIPv4Address()}:${port}`;
  });

  afterAll(async () => {
    await server.closePromise();
  });

  beforeEach(() => {
    // the CLI reports the resolved path of the working directory, for example /private/var instead of /var on macOS
    home = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-config-file-')),
    );
    workingDir = path.join(home, 'repository');
    fs.mkdirSync(workingDir);
    server.restore();
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  describe('SNYK_CONFIG_FILE', () => {
    it('reads the named file', async () => {
      const pinnedFile = path.join(home, 'elsewhere', 'snyk.json');
      fs.mkdirSync(path.dirname(pinnedFile));
      writeConfig(pinnedFile, pinnedToken);

      const result = await whoami({ SNYK_CONFIG_FILE: pinnedFile });

      expect(result.code).toEqual(0);
      expect(tokensUsed()).toEqual([`token ${pinnedToken}`]);
    });

    it('fails with SNYK-CLI-0041 when the named file cannot be used', async () => {
      const result = await whoami({ SNYK_CONFIG_FILE: 'snyk.json' });

      expect(result.code).toEqual(2);
      expect(result.stdout).toContain('SNYK-CLI-0041');
      expect(result.stderr).toEqual('');
      expect(tokensUsed()).toEqual([]);
    });
  });

  describe('snyk.json in the working directory', () => {
    const ignoredFile = () => path.join(workingDir, 'snyk.json');

    beforeEach(() => {
      writeConfig(ignoredFile(), repositoryToken);
      server.setStatusCode(401);
    });

    it('fails a Go command with SNYK-CLI-0040 when it holds the only credentials', async () => {
      const result = await whoami({ SNYK_API: endpoint });

      expect(result.code).toEqual(2);
      expect(result.stdout).toContain('SNYK-CLI-0040');
      expect(result.stdout).toContainText(ignoredFile());
      expect(tokensUsed()).not.toContain(`token ${repositoryToken}`);
    });

    it('fails a legacy command with SNYK-CLI-0040 when it holds the only credentials', async () => {
      fs.writeFileSync(
        path.join(workingDir, 'package.json'),
        JSON.stringify({ name: 'project', version: '1.0.0' }),
      );

      const result = await snyk('monitor', { SNYK_API: endpoint });

      expect(result.code).toEqual(2);
      expect(result.stdout).toContain('SNYK-CLI-0040');
      expect(result.stdout).toContainText(ignoredFile());
    });

    it('is ignored without SNYK-CLI-0040 when a profile is selected', async () => {
      const result = await whoami({
        SNYK_API: endpoint,
        SNYK_CONFIG_PROFILE: 'work',
      });

      expect(result.code).toEqual(2);
      expect(result.stdout).not.toContain('SNYK-CLI-0040');
      expect(tokensUsed()).not.toContain(`token ${repositoryToken}`);
    });

    it('is ignored without SNYK-CLI-0040 when credentials are set', async () => {
      const result = await whoami({ SNYK_API: endpoint, SNYK_TOKEN: envToken });

      expect(result.code).toEqual(2);
      expect(result.stdout).toContain('SNYK-0005');
      expect(result.stdout).not.toContain('SNYK-CLI-0040');
      expect(tokensUsed()).toEqual([`token ${envToken}`]);
    });
  });
});
