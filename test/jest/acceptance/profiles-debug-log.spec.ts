import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getAvailableServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 60);

/**
 * User journey: a person runs a command with `--debug` and a configuration profile and posts the log to a ticket. The
 * secrets of the profile (token, OAuth tokens) must not be in that log, the same as the secrets of the default profile.
 *
 * The scrubbing log writer is built from the default configuration before the profile is selected, so the secrets of
 * the profile are only covered by the generic patterns for `token <value>` and `Bearer <value>`. The trace log level
 * also logs request bodies, such as the body of an OAuth refresh request.
 */
describe('profiles: debug log', () => {
  const orgId = '55555555-5555-4555-8555-555555555555';
  const profileToken = 'SECRETPROFILETOKEN-0123456789';
  const profileRefreshToken = 'SECRETPROFILEREFRESH-0123456';
  const defaultRefreshToken = 'SECRETDEFAULTREFRESH-0123456';
  // The refresh tokens are short on purpose: the trace log shortens a long request body to its beginning and its end,
  // which cuts a long token, and a cut token no longer matches the scrubbing term of the default profile either.

  let server: ReturnType<typeof fakeServer>;
  let endpoint: string;
  let home: string;
  let profileDir: string;

  const cleanEnvironment = (): Record<string, string | undefined> =>
    Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => !/^(snyk_|internal_|test_snyk)/i.test(name),
      ),
    );

  const writeConfig = (file: string, config: Record<string, unknown>) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ endpoint, org: orgId, ...config }));
  };

  // an OAuth token that expired long ago, so the CLI sends its refresh token to the token endpoint
  const expiredOAuthToken = (refreshToken: string) => ({
    INTERNAL_OAUTH_TOKEN_STORAGE: JSON.stringify({
      access_token: 'ACCESSTOKEN-0123456789',
      token_type: 'bearer',
      refresh_token: refreshToken,
      expiry: '2000-01-01T00:00:00Z',
    }),
  });

  const whoamiWithDebug = async (extraArgs: string) => {
    const result = await runSnykCLI(
      `whoami --experimental --debug ${extraArgs}`,
      {
        env: {
          ...cleanEnvironment(),
          HOME: home,
          USERPROFILE: home,
          SNYK_DISABLE_ANALYTICS: '1',
          // the fake server speaks plain HTTP
          SNYK_HTTP_PROTOCOL_UPGRADE: '0',
          SNYK_CONFIG_PROFILE_DIR: profileDir,
        },
      },
    );
    return `${result.stdout}\n${result.stderr}`;
  };

  // whether the log has the body of a token request, so that the tests look at the right kind of line
  const logsRequestBody = (output: string): boolean =>
    /request \[[^\]]+\]: body: client_id=/.test(output);

  // the lines that contain the secret, with the secret masked so that a failure does not print it
  const linesWithSecret = (output: string, secret: string): string[] =>
    output
      .split('\n')
      .filter((line) => line.includes(secret))
      .map((line) => line.split(secret).join('<SECRET>'));

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    server = fakeServer('/api/v1', 'unused-token');
    await new Promise<void>((resolve) => server.listen(Number(port), resolve));
    endpoint = `http://${getFirstIPv4Address()}:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-profiles-log-'));
    profileDir = path.join(home, 'profiles');
    writeConfig(
      path.join(home, '.config', 'configstore', 'snyk.json'),
      expiredOAuthToken(defaultRefreshToken),
    );
    server.restore();
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('does not log the token of a profile in the request headers', async () => {
    writeConfig(path.join(profileDir, 'work.json'), { api: profileToken });

    const output = await whoamiWithDebug('--config-profile=work');

    expect(output).toContain('Using log level: debug');
    expect(linesWithSecret(output, profileToken)).toEqual([]);
  });

  it('does not log the OAuth refresh token of a profile in a request body', async () => {
    writeConfig(
      path.join(profileDir, 'work.json'),
      expiredOAuthToken(profileRefreshToken),
    );

    const output = await whoamiWithDebug(
      '--config-profile=work --log-level=trace',
    );

    // the request body is only logged at the trace level, this makes sure the test looks at the right line
    expect(logsRequestBody(output)).toBe(true);
    expect(linesWithSecret(output, profileRefreshToken)).toEqual([]);
  });

  it('does not log the OAuth refresh token of the default profile in a request body', async () => {
    const output = await whoamiWithDebug('--log-level=trace');

    expect(logsRequestBody(output)).toBe(true);
    expect(linesWithSecret(output, defaultRefreshToken)).toEqual([]);
  });
});
