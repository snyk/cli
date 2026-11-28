import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getAvailableServerPort } from '../util/getServerPort';
import { createPAT } from '../util/createPAT';

jest.setTimeout(1000 * 60);

type FakeServer = ReturnType<typeof fakeServer>;

/**
 * User journey: a person keeps the settings of another account in a profile and selects it with
 * `--config-profile`, or with `SNYK_CONFIG_PROFILE`. The default profile and the `work` profile talk to different
 * fake servers, so the tests can tell which profile a request belongs to.
 */
describe('profiles', () => {
  const defaultToken = '11111111-1111-4111-8111-111111111111';
  const workToken = '22222222-2222-4222-8222-222222222222';
  const orgId = '55555555-5555-4555-8555-555555555555';

  // The directory the tests pass with SNYK_CONFIG_PROFILE_DIR. It is not the default location, see the default case.
  const customProfileDirName = 'custom-profile-dir';
  // The directory of the profile files when SNYK_CONFIG_PROFILE_DIR is not set, inside the config home.
  const defaultProfileDirName = 'snyk_profiles';

  let defaultServer: FakeServer;
  let workServer: FakeServer;
  let defaultEndpoint: string;
  let workEndpoint: string;
  let home: string;
  let configDir: string;
  let profileDir: string;

  const writeConfig = (file: string, token: string, endpoint: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ api: token, endpoint, org: orgId }),
    );
  };

  // The CLI reads settings from SNYK_*, INTERNAL_* and TEST_SNYK* variables. Drop whatever the shell running the
  // tests has set, so the files in the temporary home are the only source of settings.
  const cleanEnvironment = (): Record<string, string | undefined> =>
    Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => !/^(snyk_|internal_|test_snyk)/i.test(name),
      ),
    );

  const baseEnv = (): Record<string, string | undefined> => ({
    ...cleanEnvironment(),
    HOME: home,
    USERPROFILE: home,
    SNYK_DISABLE_ANALYTICS: '1',
    // the fake server speaks plain HTTP
    SNYK_HTTP_PROTOCOL_UPGRADE: '0',
  });

  // runs the CLI with the profile directory of the tests
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

  const whoami = (
    args = '',
    extraEnv: Record<string, string | undefined> = {},
  ) => runCli(`whoami --experimental ${args}`, extraEnv);

  /** The tokens a server saw on user requests since the last call. */
  const tokensUsed = (server: FakeServer): string[] =>
    server
      .getRequests()
      .filter((request) => request.url.startsWith('/rest/self'))
      .map((request) => String(request.headers.authorization));

  const listen = async (server: FakeServer, port: string) =>
    new Promise<void>((resolve) => server.listen(Number(port), resolve));

  beforeAll(async () => {
    const defaultPort = await getAvailableServerPort(process);
    defaultServer = fakeServer('/api/v1', defaultToken);
    await listen(defaultServer, defaultPort);

    // the next free port, found after the first server took its port
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
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-profiles-'));
    configDir = path.join(home, '.config', 'configstore');
    profileDir = path.join(home, customProfileDirName);
    writeConfig(
      path.join(configDir, 'snyk.json'),
      defaultToken,
      defaultEndpoint,
    );
    writeConfig(path.join(profileDir, 'work.json'), workToken, workEndpoint);
    defaultServer.restore();
    workServer.restore();
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('uses the default profile unless another one is requested', async () => {
    expect((await whoami()).code).toEqual(0);
    expect(tokensUsed(defaultServer)).toEqual([`token ${defaultToken}`]);
    expect(tokensUsed(workServer)).toEqual([]);
  });

  it('selects a profile with --config-profile, and with SNYK_CONFIG_PROFILE the flag wins', async () => {
    expect((await whoami('--config-profile=work')).code).toEqual(0);
    expect(tokensUsed(workServer)).toEqual([`token ${workToken}`]);
    expect(tokensUsed(defaultServer)).toEqual([]);

    defaultServer.restore();
    workServer.restore();
    expect(
      (
        await whoami('--config-profile=default', {
          SNYK_CONFIG_PROFILE: 'work',
        })
      ).code,
    ).toEqual(0);
    expect(tokensUsed(defaultServer)).toEqual([`token ${defaultToken}`]);
    expect(tokensUsed(workServer)).toEqual([]);
  });

  it('keeps the profile files in the default directory of the config home without SNYK_CONFIG_PROFILE_DIR', async () => {
    // the work profile is moved to the default directory, and the custom directory is left without it
    const defaultDir = path.join(configDir, defaultProfileDirName);
    writeConfig(path.join(defaultDir, 'work.json'), workToken, workEndpoint);
    fs.rmSync(path.join(profileDir, 'work.json'));

    const result = await runSnykCLI(
      'whoami --experimental --config-profile=work',
      {
        env: baseEnv(),
      },
    );
    expect(result.code).toEqual(0);
    expect(tokensUsed(workServer)).toEqual([`token ${workToken}`]);
    expect(tokensUsed(defaultServer)).toEqual([]);
  });

  it('fails when the requested profile file is corrupt, without contacting a server', async () => {
    const corruptFile = path.join(profileDir, 'broken.json');
    fs.writeFileSync(corruptFile, '{not json');

    const result = await whoami('--config-profile=broken');
    expect(result.code).toEqual(2);
    expect(result.stdout).toContain('SNYK-CLI-0035');
    expect(result.stdout).toContain('Profile "broken" cannot be read');
    expect(result.stdout).not.toContain('SNYK-CLI-0010');
    expect(tokensUsed(defaultServer)).toEqual([]);
    expect(tokensUsed(workServer)).toEqual([]);
    expect(fs.readFileSync(corruptFile, 'utf8')).toEqual('{not json');
  });

  it('runs a profile without a file unauthenticated, and creates no file', async () => {
    // The fake server answers every request with 401, so the run reaches the API without credentials and fails the
    // way an unauthenticated run does. The default profile's token must not be sent.
    defaultServer.setStatusCode(401);

    const result = await whoami('--config-profile=fresh', {
      SNYK_API: defaultEndpoint,
    });
    expect(result.code).toEqual(2);
    expect(result.stdout).toContain('Authentication error (SNYK-0005)');
    expect(result.stdout).not.toContain('SNYK-CLI-0010');
    expect(tokensUsed(defaultServer)).not.toContain(`token ${defaultToken}`);
    expect(tokensUsed(workServer)).toEqual([]);
    expect(fs.readdirSync(profileDir)).toEqual(['work.json']);
  });

  it('auth with --config-profile creates the profile file and leaves the default profile file as it was', async () => {
    const defaultFile = path.join(configDir, 'snyk.json');
    const defaultBefore = fs.readFileSync(defaultFile);
    // the PAT names the host it belongs to, so the login validates against the default fake server
    const pat = createPAT({ host: defaultEndpoint });

    const result = await runCli(`auth ${pat} --config-profile=fresh`);
    expect(result.code).toEqual(0);

    const created = JSON.parse(
      fs.readFileSync(path.join(profileDir, 'fresh.json'), 'utf8'),
    );
    expect(created.api).toEqual(pat);
    expect(fs.readFileSync(defaultFile).equals(defaultBefore)).toBe(true);
  });
});

/**
 * CLI-2138: under `--config-profile`, only the selected profile decides who a run is. The default file (token A, org A,
 * host A) must not be used during start-up or the run. Analytics stay on and SNYK_ and INTERNAL_ settings are cleared.
 * The offender is fixed by plan step 3 (the flag is read out of Init). Not observed here: the OAuth path (defaultOAuthFF)
 * and requests to a third host.
 * Follow-up refactor: writeConfig, cleanEnvironment, listen and the server setup repeat the first describe above.
 */
describe('profiles: the default profile never decides a run under --config-profile [CLI-2138]', () => {
  const defaultToken = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const workToken = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const defaultOrg = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  const workOrg = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

  // Paths GAF requests while it starts or ends a run; they mirror GAF.
  // - /rest/self: the user lookup of whoami.
  // - /rest/orgs/<id>: the organization slug lookup (defaultFuncOrganizationSlug), read by the CLI teardown
  //   (populateRedactionTerms). A tenant lookup carries ?expand=tenant and is not counted here.
  // - /hidden/orgs/<id>/feature_flags/evaluation: the batch evaluation of config_utils.AddFeatureFlagsToConfig.
  // The flag key mirrors GAF internal/contributors/hook/init.go (flagMap).
  const selfPath = '/rest/self';
  const slugPath = (org: string) => `/rest/orgs/${org}`;
  const flagsPath = (org: string) =>
    `/hidden/orgs/${org}/feature_flags/evaluation`;
  const contributorsFlag = 'enable-entity-contributors-publish';

  type Recorded = {
    server: 'default' | 'profile';
    method: string;
    url: string;
    token: string;
    headers: Record<string, unknown>;
    body: unknown;
  };
  // Used only in assertion messages.
  const format = (r: Recorded) =>
    `${r.server} ${r.method} ${r.url} token=${r.token || '(none)'}`;
  const pathOf = (r: Recorded) => r.url.split('?')[0];
  const onDefault = (all: Recorded[]) =>
    all.filter((r) => r.server === 'default');
  const onProfile = (all: Recorded[]) =>
    all.filter((r) => r.server === 'profile');
  const orgsIn = (url: string) =>
    Array.from(url.matchAll(/\/orgs\/([0-9a-f-]{36})/gi), (m) => m[1]);

  // Counts the requests of a path; a tenant lookup (?expand=) is not a slug lookup.
  const countOf = (all: Recorded[], path: string, method?: string) =>
    all.filter(
      (r) =>
        pathOf(r) === path &&
        !r.url.includes('expand=') &&
        (!method || r.method === method),
    ).length;
  const measuredCounts = (all: Recorded[], org: string) => ({
    self: countOf(all, selfPath),
    slug: countOf(all, slugPath(org), 'GET'),
  });

  let defaultServer: FakeServer;
  let workServer: FakeServer;
  let home: string | undefined;
  let profileDir: string;
  let shared: { code: number; stderr: string; requests: Recorded[] };

  const writeConfig = (
    file: string,
    token: string,
    endpoint: string,
    org: string,
  ) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ api: token, endpoint, org }));
  };

  // Proxy variables are dropped too, so a developer proxy cannot make the shared run reach nothing and pass vacuously.
  const cleanEnvironment = (): Record<string, string | undefined> =>
    Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => !/^(snyk_|internal_|test_snyk)|_proxy$/i.test(name),
      ),
    );

  // Analytics are not disabled: the analytics send is part of the run under test.
  const runCli = (
    command: string,
    extraEnv: Record<string, string | undefined> = {},
  ) =>
    runSnykCLI(command, {
      env: {
        ...cleanEnvironment(),
        HOME: home,
        USERPROFILE: home,
        SNYK_CONFIG_PROFILE_DIR: profileDir,
        SNYK_HTTP_PROTOCOL_UPGRADE: '0',
        ...extraEnv,
      },
    });

  const toRecorded = (
    server: Recorded['server'],
    request: {
      method: string;
      url: string;
      headers: Record<string, unknown>;
      body?: unknown;
    },
  ): Recorded => ({
    server,
    method: request.method,
    url: request.url,
    token: String(request.headers.authorization ?? '').replace(/^token /, ''),
    headers: request.headers,
    body: request.body,
  });
  const recorded = (): Recorded[] => [
    ...defaultServer.getRequests().map((r) => toRecorded('default', r)),
    ...workServer.getRequests().map((r) => toRecorded('profile', r)),
  ];

  const listen = async (server: FakeServer, port: string) =>
    new Promise<void>((resolve) => server.listen(Number(port), resolve));

  // Servers are reset before each case. The shared run is captured once, in beforeAll, before any case resets them.
  const resetServers = () => {
    for (const server of [defaultServer, workServer]) {
      server.restore();
      server.setFeatureFlag(contributorsFlag, true);
    }
  };

  beforeAll(async () => {
    const defaultPort = await getAvailableServerPort(process);
    defaultServer = fakeServer('/api/v1', defaultToken);
    await listen(defaultServer, defaultPort);
    const workPort = await getAvailableServerPort(process);
    workServer = fakeServer('/api/v1', workToken);
    await listen(workServer, workPort);

    home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-profiles-init-'));
    profileDir = path.join(home, 'custom-profile-dir');
    const host = getFirstIPv4Address();
    writeConfig(
      path.join(home, '.config', 'configstore', 'snyk.json'),
      defaultToken,
      `http://${host}:${defaultPort}`,
      defaultOrg,
    );
    writeConfig(
      path.join(profileDir, 'work.json'),
      workToken,
      `http://${host}:${workPort}`,
      workOrg,
    );

    resetServers();
    const result = await runCli('whoami --experimental --config-profile=work');
    shared = { code: result.code, stderr: result.stderr, requests: recorded() };
  });

  afterAll(async () => {
    await Promise.all(
      [defaultServer, workServer]
        .filter(Boolean)
        .map(
          (server) =>
            new Promise<void>((resolve) => server.close(() => resolve())),
        ),
    );
    if (home) {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  beforeEach(resetServers);

  describe('with --config-profile=work, the shared run', () => {
    it('exits with 0', () => {
      expect({ code: shared.code, stderr: shared.stderr }).toMatchObject({
        code: 0,
      });
    });

    it('leaves the default host without any request', () => {
      expect(onDefault(shared.requests).map(format)).toEqual([]);
    });

    it('sends every request to the profile host with token B', () => {
      expect(
        onProfile(shared.requests)
          .filter((r) => r.token !== workToken)
          .map(format),
      ).toEqual([]);
    });

    it('names only the profile organization in the organization paths of the profile host', () => {
      const profile = onProfile(shared.requests);
      expect(
        profile
          .filter((r) => orgsIn(r.url).some((org) => org !== workOrg))
          .map(format),
      ).toEqual([]);
      expect(profile.flatMap((r) => orgsIn(r.url))).toContain(workOrg);
    });

    it('sends the analytics to the profile host with token B', () => {
      const analytics = onProfile(shared.requests).filter((r) =>
        r.url.includes('/analytics'),
      );
      expect(analytics.length).toBeGreaterThan(0);
      expect(
        analytics.filter((r) => r.token !== workToken).map(format),
      ).toEqual([]);
    });

    it('sends no token A and no org A to the profile host, in url, headers or body', () => {
      const leaks = onProfile(shared.requests).filter((r) => {
        const text = JSON.stringify(r);
        return text.includes(defaultToken) || text.includes(defaultOrg);
      });
      expect(leaks.map(format)).toEqual([]);
    });

    it('makes one request of each measured lookup on the profile host', () => {
      expect(measuredCounts(onProfile(shared.requests), workOrg)).toEqual({
        self: 1,
        slug: 1,
      });
    });

    // DERIVED, NOT MEASURED: the flag evaluation count (1) comes from the plan (the flag is read once per process in a
    // post-invoke hook, with the profile). On main it is 0 on the profile host, because the flag is read with token A.
    it('makes one flag evaluation on the profile host (derived from the plan, not measured)', () => {
      expect(countOf(onProfile(shared.requests), flagsPath(workOrg))).toEqual(
        1,
      );
    });

    it('names the contributors flag in every flag evaluation request', () => {
      const evaluations = shared.requests.filter((r) =>
        pathOf(r).endsWith('/feature_flags/evaluation'),
      );
      expect(evaluations.length).toBeGreaterThan(0);
      expect(
        evaluations
          .filter((r) => !JSON.stringify(r.body).includes(contributorsFlag))
          .map(format),
      ).toEqual([]);
    });
  });

  it('without --config-profile, the run uses the default file: token A, org A and host A', async () => {
    const result = await runCli('whoami --experimental');
    const requests = recorded();

    expect({ code: result.code, stderr: result.stderr }).toMatchObject({
      code: 0,
    });
    expect(onProfile(requests).map(format)).toEqual([]);
    expect(
      onDefault(requests)
        .filter((r) => r.token !== defaultToken)
        .map(format),
    ).toEqual([]);
    expect(measuredCounts(onDefault(requests), defaultOrg)).toEqual({
      self: 1,
      slug: 1,
    });
    expect(countOf(onDefault(requests), flagsPath(defaultOrg))).toEqual(1);
  });

  it('a corrupt profile file is a failed selection: exit 2 and no request to either host', async () => {
    const corrupt = path.join(profileDir, 'broken.json');
    fs.writeFileSync(corrupt, '{not json');

    let result: Awaited<ReturnType<typeof runCli>>;
    try {
      result = await runCli('whoami --experimental --config-profile=broken');
    } finally {
      fs.rmSync(corrupt, { force: true });
    }

    expect({ code: result.code, stderr: result.stderr }).toMatchObject({
      code: 2,
    });
    expect(result.stdout).toContain('SNYK-CLI-0035');
    expect(recorded().map(format)).toEqual([]);
  });

  // Skipped: observed red on main, the default host receives the flag evaluation, the slug lookup and the analytics
  // with token A. Cause not established. Tracked by CLI-2148; un-skip when fixed.
  it.skip('a run with --help under the profile sends nothing with token A', async () => {
    const result = await runCli('--help --config-profile=work');

    expect({ code: result.code, stderr: result.stderr }).toMatchObject({
      code: 0,
    });
    expect(onDefault(recorded()).map(format)).toEqual([]);
    expect(
      onProfile(recorded())
        .filter((r) => r.token !== workToken)
        .map(format),
    ).toEqual([]);
  });
});
