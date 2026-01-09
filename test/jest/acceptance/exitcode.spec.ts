import { runSnykCLI } from '../util/runSnykCLI';
import { isWindowsOperatingSystem, describeIf } from '../../utils';
import { EXIT_CODES } from '../../../src/cli/exit-codes';
import { FakeServer, fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { getAvailableServerPort } from '../util/getServerPort';
const { promisify } = require('util');

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
  it('Correct exit code when snyk_timeout_secs expires', async () => {
    const testEnv = {
      ...process.env,
      SNYK_TIMEOUT_SECS: '1',
    };

    const { code } = await runSnykCLI(`test --all-projects -d`, {
      env: testEnv,
    });

    expect(code).toEqual(EXIT_CODES.EX_UNAVAILABLE);
  });

  describe('[SNYK-0099] Maintenance error', () => {
    let server: FakeServer;
    let apiPort: string;
    let fakeServerUrl: string;
    let fakeServerHost: string;
    let fakeServerEnv: Record<string, string>;

    const serverToken = 'random';
    const apiPath = '/api/v1';

    const errorObject = {
      jsonapi: { version: '1.0' },
      errors: [
        {
          id: '11111111-2222-3333-4444-555555555555',
          links: {
            about:
              'https://docs.snyk.io/scan-with-snyk/error-catalog#snyk-0099',
          },
          status: '503',
          code: 'SNYK-0099',
          title: 'Unavailable due to maintenance',
          detail: '',
          meta: {
            links: [
              'https://status.snyk.io/',
              'https://privatecloudstatus.snyk.io',
            ],
            isErrorCatalogError: true,
            classification: 'UNSUPPORTED',
            level: 'error',
          },
        },
      ],
      description:
        'We are currently unavailable due to a maintenance window. For additional information please visit our status pages. Thank you for your patience.',
    };

    beforeEach(async () => {
      apiPort = await getAvailableServerPort(process);
      fakeServerHost = 'http://' + getFirstIPv4Address() + ':' + apiPort;
      fakeServerUrl = fakeServerHost + apiPath;
      fakeServerEnv = {
        ...process.env,
        SNYK_API: fakeServerUrl,
        SNYK_DISABLE_ANALYTICS: '1',
        SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      };

      server = fakeServer(apiPath, serverToken);
      const serverListen = promisify(server.listen);
      await serverListen(apiPort);
    });

    afterEach(async () => {
      const serverClose = promisify(server.close);
      await serverClose();
    });

    describe('no retry-after header in error response', () => {
      beforeEach(async () => {
        server.setGlobalResponse(
          errorObject,
          parseInt(errorObject['errors'][0].status),
        );
      })

      it('Does not attempt any retries', async () => {
        await runSnykCLI(`test -d --log-level=trace`, {
          env: {
            ...fakeServerEnv,
            // apply a user configured attempts of 10
            INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '10',
          },
        });

        // Count how many times an endpoint was hit
        const requests = server.getRequests();
        const testEndpointHits = requests.filter(r =>
          r.url.includes('/test-dep-graph') || r.url.includes('/vuln/')
        ).length;

        expect(testEndpointHits).toBe(1); // Only 1 attempt, no retries
      });
    });

    describe('retry-after header in error response', () => {
      it('Respects retry-after header', async () => {
        server.setGlobalResponse(
          errorObject,
          parseInt(errorObject['errors'][0].status),
          { 'retry-after': '1' },
        );

        const { stderr } = await runSnykCLI(`test -d --log-level=trace`, {
          env: {
            ...fakeServerEnv,
            INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '2',
          },
        });

        const expectedRetryAfterDebugMsg = 'Retrying request, reason: retry after 1s';
        const expectedRetryAfterHeaderDebugMsg = 'Retry-After:[1]';
        expect(stderr).toContain(expectedRetryAfterDebugMsg);
        expect(stderr).toContain(expectedRetryAfterHeaderDebugMsg);

        const requests = server.getRequests();
        const testEndpointHits = requests.filter(r =>
          r.url.includes('/test-dep-graph') || r.url.includes('/vuln/')
        ).length;

        expect(testEndpointHits).toBe(2); // expected 2 network attempts
      });
    });

    it('Correct exit code', async () => {
      server.setGlobalResponse(
        errorObject,
        parseInt(errorObject['errors'][0].status),
      );

      const { code, stdout } = await runSnykCLI(`test`, {
        env: {
          ...fakeServerEnv,
          INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '1',
        },
      });


      expect(stdout).toContain(errorObject['errors'][0].code);
      expect(code).toEqual(EXIT_CODES.EX_TEMPFAIL);
    });
  });
});
