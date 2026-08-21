import { runSnykCLI } from '../util/runSnykCLI';
import { isWindowsOperatingSystem, describeIf } from '../../utils';
import { EXIT_CODES } from '../../../src/cli/exit-codes';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { getAvailableServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 60);

const notWindows = !isWindowsOperatingSystem();

// Address as part CLI-1207
describeIf(notWindows)('exit code behaviour - legacycli', () => {
  it.each([
    { input: 0, expected: 0 },
    { input: 1, expected: 1 },
    { input: 2, expected: 2 },
    { input: 3, expected: 3 },
    { input: -1, expected: 2 },
  ])(
    'map legacy cli exit code $input to $expected',
    async ({ input, expected }) => {
      const { code } = await runSnykCLI(
        `woof --exit-code=${input} --language=cat -d`,
      );
      expect(code).toEqual(expected);
    },
  );
});

describe('exit code behaviour - general', () => {
  let server: ReturnType<typeof fakeServer>;
  let baseEnv: Record<string, string>;

  beforeAll(async () => {
    const ipAddr = getFirstIPv4Address();
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';

    baseEnv = {
      ...process.env,
      SNYK_API: 'http://' + ipAddr + ':' + port + baseApi,
      SNYK_HOST: 'http://' + ipAddr + ':' + port,
      SNYK_TOKEN: '123456789',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      // A configured org skips the CLI's default-org network lookup. Without it, that
      // lookup is a GET (a "safe" HTTP method, always eligible for retry regardless of
      // any allow-list) which also hits the delayed server below and gets retried
      // multiple times, adding tens of seconds before the CLI can exit -- well past
      // the watchdog's kill window and past this suite's jest timeout.
      SNYK_CFG_ORG: '11111111-1111-1111-1111-111111111111',
    };

    server = fakeServer(baseApi, baseEnv.SNYK_TOKEN);
    await server.listenPromise(port);
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await server.closePromise();
  });

  it('Correct exit code when snyk_timeout_secs expires', async () => {
    // Response delay exceeds the watchdog's kill window (timeout + grace period), so
    // the CLI is always force-killed before any response can arrive -- deterministic
    // regardless of how many retries GAF performs underneath.
    server.setResponseDelay(10000);

    const testEnv = {
      ...baseEnv,
      SNYK_TIMEOUT_SECS: '5',
    };

    const { code } = await runSnykCLI(`test --all-projects -d`, {
      env: testEnv,
    });

    expect(code).toEqual(EXIT_CODES.EX_UNAVAILABLE);
  });
});
