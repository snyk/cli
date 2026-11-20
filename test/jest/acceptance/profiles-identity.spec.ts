import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getAvailableServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 60);

type FakeServer = ReturnType<typeof fakeServer>;

/**
 * FRG-426: under a named config profile, ambient identity environment variables must not
 * supply credentials. Proxy/API URL variables may still apply.
 */
describe('profiles identity environment variables', () => {
  const profileToken = '22222222-2222-4222-8222-222222222222';
  const ambientToken = '33333333-3333-4333-8333-333333333333';
  const orgId = '55555555-5555-4555-8555-555555555555';

  let server: FakeServer;
  let endpoint: string;
  let home: string;
  let profileDir: string;

  const writeProfile = (file: string, token: string, api: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ api: token, endpoint: api, org: orgId }),
    );
  };

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
    SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    SNYK_CONFIG_PROFILE_DIR: profileDir,
  });

  const tokensUsed = (): string[] =>
    server
      .getRequests()
      .filter((request) => request.url.startsWith('/rest/self'))
      .map((request) => String(request.headers.authorization));

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    server = fakeServer('/api/v1', profileToken);
    await new Promise<void>((resolve) =>
      server.listen(Number(port), resolve),
    );
    endpoint = `http://${getFirstIPv4Address()}:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-profiles-identity-'));
    profileDir = path.join(home, 'profiles');
    writeProfile(path.join(profileDir, 'work.json'), profileToken, endpoint);
    server.restore();
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('Go whoami uses the profile token, not ambient SNYK_TOKEN', async () => {
    const result = await runSnykCLI(
      'whoami --experimental --config-profile=work',
      {
        env: {
          ...baseEnv(),
          SNYK_TOKEN: ambientToken,
        },
      },
    );

    expect(result.code).toEqual(0);
    expect(tokensUsed()).toEqual([`token ${profileToken}`]);
    expect(tokensUsed()).not.toContain(`token ${ambientToken}`);
    expect(result.stderr).toContain('SNYK_TOKEN');
    expect(result.stderr).not.toContain(ambientToken);
  });

  it('Go whoami stays unauthenticated when the profile is empty despite ambient SNYK_TOKEN', async () => {
    server.setStatusCode(401);

    const result = await runSnykCLI(
      'whoami --experimental --config-profile=fresh',
      {
        env: {
          ...baseEnv(),
          SNYK_TOKEN: ambientToken,
          SNYK_API: endpoint,
        },
      },
    );

    expect(result.code).toEqual(2);
    expect(result.stdout).toContain('Authentication error (SNYK-0005)');
    expect(tokensUsed()).not.toContain(`token ${ambientToken}`);
    expect(result.stderr).toContain('SNYK_TOKEN');
  });

  it('legacy woof runs under a named profile (refusal lifted)', async () => {
    const result = await runSnykCLI('woof --config-profile=work', {
      env: {
        ...baseEnv(),
        SNYK_TOKEN: ambientToken,
      },
    });

    expect(result.code).toEqual(0);
    expect(result.stdout).toContain('Woof!');
    expect(result.stderr).not.toContain("doesn't support configuration profiles");
    expect(result.stderr).toContain('SNYK_TOKEN');
  });

  it('legacy config get does not read ambient SNYK_CFG_API under a named profile', async () => {
    const result = await runSnykCLI('config get api --config-profile=fresh', {
      env: {
        ...baseEnv(),
        SNYK_CFG_API: ambientToken,
      },
    });

    expect(result.code).toEqual(0);
    expect(result.stdout.trim()).toEqual('');
    expect(result.stderr).toContain('SNYK_CFG_API');
    expect(result.stderr).not.toContain(ambientToken);
  });
});
