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
