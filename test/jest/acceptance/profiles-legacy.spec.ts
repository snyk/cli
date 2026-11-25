import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';
import { getAvailableServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 120);

type FakeServer = ReturnType<typeof fakeServer>;

/**
 * User journey: a person selects a profile for a command that runs in the legacy CLI process. The process must use
 * the profile's file, and never read or write the default file. The default profile and the `work` profile talk to
 * different fake servers, so the tests can tell which profile a request belongs to.
 */
describe('profiles in the legacy CLI', () => {
  const defaultToken = '11111111-1111-4111-8111-111111111111';
  const workToken = '22222222-2222-4222-8222-222222222222';
  const defaultOrg = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  // the legacy CLI sends its requests to <endpoint>/v1
  const legacyBasePath = '/v1';

  let defaultServer: FakeServer;
  let workServer: FakeServer;
  let defaultEndpoint: string;
  let workEndpoint: string;
  let home: string;
  let defaultFile: string;
  let profileDir: string;
  let workFile: string;

  const writeJson = (file: string, content: Record<string, string>) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(content));
  };
  const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));

  const runCli = (
    command: string,
    options: { cwd?: string; env?: Record<string, string> } = {},
  ) =>
    runSnykCLI(command, {
      cwd: options.cwd,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([name]) =>
              !/^(snyk_|internal_|test_snyk|xdg_config_home$)/i.test(name),
          ),
        ),
        HOME: home,
        USERPROFILE: home,
        SNYK_DISABLE_ANALYTICS: '1',
        SNYK_HTTP_PROTOCOL_UPGRADE: '0',
        SNYK_CONFIG_PROFILE_DIR: profileDir,
        ...options.env,
      },
    });

  const legacyRequests = (server: FakeServer) =>
    server
      .getRequests()
      .filter((request) => request.url.startsWith(legacyBasePath + '/'));

  const requestsNamingTheDefaultOrg = (server: FakeServer) =>
    server
      .getRequests()
      .filter((request) =>
        `${request.url} ${JSON.stringify(request.body)}`.includes(defaultOrg),
      )
      .map((request) => `${request.method} ${request.url}`);

  beforeAll(async () => {
    const defaultPort = await getAvailableServerPort(process);
    defaultServer = fakeServer(legacyBasePath, defaultToken);
    await defaultServer.listenPromise(defaultPort);

    const workPort = await getAvailableServerPort(process);
    workServer = fakeServer(legacyBasePath, workToken);
    await workServer.listenPromise(workPort);

    const host = getFirstIPv4Address();
    defaultEndpoint = `http://${host}:${defaultPort}`;
    workEndpoint = `http://${host}:${workPort}`;
  });

  afterAll(async () => {
    await Promise.all([
      defaultServer.closePromise(),
      workServer.closePromise(),
    ]);
  });

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-profiles-legacy-'));
    defaultFile = path.join(home, '.config', 'configstore', 'snyk.json');
    profileDir = path.join(home, 'profiles');
    workFile = path.join(profileDir, 'work.json');
    writeJson(defaultFile, {
      api: defaultToken,
      endpoint: defaultEndpoint,
      org: defaultOrg,
    });
    writeJson(workFile, { api: workToken, endpoint: workEndpoint });
    defaultServer.restore();
    workServer.restore();
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('monitor does not use the organization of the default file', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');

    const result = await runCli('monitor --config-profile=work', {
      cwd: project.path(),
    });

    expect(result.code).toEqual(0);
    expect(
      legacyRequests(workServer).some((request) =>
        request.url.includes('/monitor/'),
      ),
    ).toBe(true);
    expect(requestsNamingTheDefaultOrg(workServer)).toEqual([]);
    expect(legacyRequests(defaultServer)).toEqual([]);
  });

  it('test with "--config-profile work" scans the project and not a path named "work"', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');

    const result = await runCli('test --config-profile work', {
      cwd: project.path(),
    });

    expect(result.code).toEqual(0);
    expect(result.stdout).toMatch(/Project path:\s+\S*no-vulns/);
    expect(result.stdout).not.toMatch(/Project path:\s+work/);
    expect(legacyRequests(defaultServer)).toEqual([]);
  });

  describe.each([
    ['an API token', `auth ${workToken}`, {}],
    ['an unknown auth type', `auth --auth-type=unknown ${workToken}`, {}],
    [
      'an IDE integration',
      `auth ${workToken}`,
      { SNYK_INTEGRATION_NAME: 'VS_CODE', SNYK_INTEGRATION_VERSION: '1.0.0' },
    ],
  ])('legacy login with %s', (_, command, env) => {
    it('stores the token in the profile file and leaves the default file as it was', async () => {
      writeJson(workFile, { endpoint: workEndpoint });
      const defaultBefore = fs.readFileSync(defaultFile);

      const result = await runCli(`${command} --config-profile=work`, { env });

      expect(result.code).toEqual(0);
      expect(readJson(workFile)).toEqual({
        api: workToken,
        endpoint: workEndpoint,
      });
      expect(fs.readFileSync(defaultFile).equals(defaultBefore)).toBe(true);
    });
  });

  it.each([['test'], ['monitor'], ['iac test'], [`auth ${workToken}`]])(
    '"%s" with a corrupt profile file fails before the legacy CLI runs',
    async (command) => {
      fs.writeFileSync(workFile, '{not json');
      const defaultBefore = fs.readFileSync(defaultFile);

      const result = await runCli(`${command} --config-profile=work`);

      expect(result.code).toEqual(2);
      expect(result.stdout).toContain('SNYK-CLI-0035');
      expect(fs.readFileSync(workFile, 'utf8')).toEqual('{not json');
      expect(fs.readFileSync(defaultFile).equals(defaultBefore)).toBe(true);
      expect(workServer.getRequests()).toEqual([]);
      expect(legacyRequests(defaultServer)).toEqual([]);
    },
  );

  it('without a profile the legacy CLI uses the default file, even when the parent process names another file', async () => {
    writeJson(defaultFile, { endpoint: defaultEndpoint });
    const otherFile = path.join(home, 'other.json');

    const result = await runCli(`auth ${defaultToken}`, {
      env: { SNYK_INTERNAL_CONFIG_FILE: otherFile },
    });

    expect(result.code).toEqual(0);
    expect(readJson(defaultFile)).toEqual({
      api: defaultToken,
      endpoint: defaultEndpoint,
    });
    expect(fs.existsSync(otherFile)).toBe(false);
  });
});
