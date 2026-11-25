import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getAvailableServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 60);

type FakeServer = ReturnType<typeof fakeServer>;

/**
 * CLI-2138: under `--config-profile`, no request may carry the default profile's token.
 * Default file: token A + org A; named profile: token B + org B. Analytics stay enabled so
 * an Init-time analytics or feature-flag call with token A would fail the suite.
 */
describe('profiles: Init must not use the default profile credentials [CLI-2138]', () => {
  const defaultToken = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const workToken = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const defaultOrg = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  const workOrg = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

  const customProfileDirName = 'custom-profile-dir';

  let defaultServer: FakeServer;
  let workServer: FakeServer;
  let defaultEndpoint: string;
  let workEndpoint: string;
  let home: string;
  let configDir: string;
  let profileDir: string;

  const writeConfig = (
    file: string,
    token: string,
    endpoint: string,
    org: string,
  ) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ api: token, endpoint, org }));
  };

  const cleanEnvironment = (): Record<string, string | undefined> =>
    Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => !/^(snyk_|internal_|test_snyk)/i.test(name),
      ),
    );

  // Analytics stay on: an Init-time analytics call with the default token must fail the test.
  const baseEnv = (): Record<string, string | undefined> => ({
    ...cleanEnvironment(),
    HOME: home,
    USERPROFILE: home,
    SNYK_HTTP_PROTOCOL_UPGRADE: '0',
  });

  const runCli = (
    command: string,
    extraEnv: Record<string, string | undefined> = {},
  ) =>
    runSnykCLI(command, {
      env: {
        ...baseEnv(),
        SNYK_CONFIG_PROFILE_DIR: profileDir,
        ...extraEnv,
      },
    });

  const authorizationOf = (request: { headers: Record<string, unknown> }) =>
    String(request.headers.authorization ?? '');

  const allRequests = () => [
    ...defaultServer.getRequests(),
    ...workServer.getRequests(),
  ];

  const authorizations = () => allRequests().map(authorizationOf);

  /** Paths that Init historically resolved early (org, /rest/self, feature flags). */
  const isEarlyLookup = (url: string): boolean =>
    url.includes('/rest/self') ||
    /\/rest\/orgs\/[^/?]+(\?|$)/.test(url) ||
    url.includes('feature-flag') ||
    url.includes('feature_flag');

  const listen = async (server: FakeServer, port: string) =>
    new Promise<void>((resolve) => server.listen(Number(port), resolve));

  beforeAll(async () => {
    const defaultPort = await getAvailableServerPort(process);
    defaultServer = fakeServer('/api/v1', defaultToken);
    await listen(defaultServer, defaultPort);

    const workPort = await getAvailableServerPort(process);
    workServer = fakeServer('/api/v1', workToken);
    await listen(workServer, workPort);

    const host = getFirstIPv4Address();
    defaultEndpoint = `http://${host}:${defaultPort}`;
    workEndpoint = `http://${host}:${workPort}`;
  });

  afterAll(async () => {
    await Promise.all(
      [defaultServer, workServer].map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
  });

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-profiles-init-'));
    configDir = path.join(home, '.config', 'configstore');
    profileDir = path.join(home, customProfileDirName);
    writeConfig(
      path.join(configDir, 'snyk.json'),
      defaultToken,
      defaultEndpoint,
      defaultOrg,
    );
    writeConfig(
      path.join(profileDir, 'work.json'),
      workToken,
      workEndpoint,
      workOrg,
    );
    defaultServer.restore();
    workServer.restore();
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('with --config-profile, no request carries the default token; early lookups use the profile at most once', async () => {
    const result = await runCli('whoami --experimental --config-profile=work');
    expect(result.code).toEqual(0);

    const auths = authorizations();
    expect(auths).not.toContain(`token ${defaultToken}`);
    expect(auths.some((a) => a === `token ${workToken}`)).toBe(true);

    const earlyByPath = new Map<string, number>();
    for (const request of allRequests()) {
      if (!isEarlyLookup(request.url)) {
        continue;
      }
      expect(authorizationOf(request)).toEqual(`token ${workToken}`);
      // strip query so /rest/self?version=… counts once
      const pathOnly = request.url.split('?')[0];
      earlyByPath.set(pathOnly, (earlyByPath.get(pathOnly) ?? 0) + 1);
    }
    for (const [pathOnly, count] of earlyByPath) {
      expect({ path: pathOnly, count }).toEqual({
        path: pathOnly,
        count: expect.any(Number),
      });
      expect(count).toBeLessThanOrEqual(1);
    }

    expect(defaultServer.getRequests()).toEqual([]);
  });

  it('a refused no-network command never sends the default token under --config-profile', async () => {
    // Legacy commands are refused for a non-default profile before they run. Init,
    // selection, and teardown must not use the default profile's credentials.
    // Teardown may still report / resolve org with the selected profile (token B).
    const result = await runCli('woof --config-profile=work');
    expect(result.code).not.toEqual(0);
    expect(result.stdout + result.stderr).toMatch(
      /doesn't support configuration profiles|SNYK-CLI-/i,
    );

    expect(authorizations()).not.toContain(`token ${defaultToken}`);
    expect(defaultServer.getRequests()).toEqual([]);
    for (const request of allRequests()) {
      expect(authorizationOf(request)).toEqual(`token ${workToken}`);
    }
  });
});
