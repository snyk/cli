import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getAvailableServerPort } from '../util/getServerPort';
import { EXIT_CODES } from '../../../src/cli/exit-codes';
import { getCliConfig, restoreCliConfig } from '../../acceptance/config-helper';

jest.setTimeout(1000 * 60); // 60 seconds - tests involve timeouts

// SNYK_TIMEOUT_SECS=5, server delay=10s, grace period=3s
// Expected: CLI should timeout around 8s (5+3), definitely before server responds at 10s
const TIMEOUT_SECS = 5;
const GRACE_PERIOD_SECS = 5;
const SERVER_DELAY_MS = 10000;
const EXPECTED_MIN_MS = TIMEOUT_SECS * 1000; // At least the timeout duration
const EXPECTED_MAX_MS = (TIMEOUT_SECS + GRACE_PERIOD_SECS) * 1000; // Timeout + grace
const orgId = '11111111-2222-3333-4444-555555555555';

describe('timeout behavior [exit code 69]', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let initialConfig: Record<string, string> = {};

  beforeAll(async () => {
    const ipAddr = getFirstIPv4Address();
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';

    env = {
      ...process.env,
      SNYK_API: 'http://' + ipAddr + ':' + port + baseApi,
      SNYK_TOKEN: '123456789',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      SNYK_CFG_ORG: orgId,
      // Disable retries to speed up tests
      INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '1',
      // Set a short timeout for testing (5 seconds)
      SNYK_TIMEOUT_SECS: String(TIMEOUT_SECS),
    };

    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
  });

  beforeEach(async () => {
    initialConfig = await getCliConfig();
    // Set server to delay responses longer than the timeout (10s > 5s timeout)
    server.setResponseDelay(SERVER_DELAY_MS);
  });

  afterEach(async () => {
    server.restore();
    await restoreCliConfig(initialConfig);
  });

  afterAll(async () => {
    await server.closePromise();
  });

  it.each([
    ['code test'],
    ['test'],
    ['container test scratch'],
    ['container monitor scratch'],
    ['iac test'],
    ['monitor'],
    ['whoami'],
    ['auth 11111111-2222-3333-4444-555555555555'],
    ['sbom --format=cyclonedx1.4+json -d'],
  ])(
    'returns exit code 69 (EX_UNAVAILABLE) on timeout for "%s"',
    async (args) => {
      const startTime = Date.now();
      const { code, stdout } = await runSnykCLI(args, {
        env,
      });
      const duration = Date.now() - startTime;

      console.log(stdout);

      // print duration and min and max in seconds
      console.log(
        `Duration: ${duration / 1000} seconds, Min: ${EXPECTED_MIN_MS / 1000} seconds, Max: ${EXPECTED_MAX_MS / 1000} seconds`,
      );

      // Should return exit code 69 for timeout
      expect(code).toEqual(EXIT_CODES.EX_UNAVAILABLE);

      // Should contain timeout-related message
      expect(stdout).toContain('SNYK-CLI-0026');

      // Should timeout within expected bounds (not wait for full server delay)
      expect(duration).toBeGreaterThanOrEqual(EXPECTED_MIN_MS);
      expect(duration).toBeLessThan(EXPECTED_MAX_MS);

      // Should send instrumentation data even on timeout
      const requests = server.getRequests();
      const instrumentationRequest = requests.find((r) =>
        r.url?.includes(`/api/hidden/orgs/${orgId}/analytics`),
      );
      expect(instrumentationRequest).toBeDefined();
    },
  );
});
