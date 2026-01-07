import { runSnykCLI } from '../util/runSnykCLI';
import { isWindowsOperatingSystem, describeIf } from '../../utils';
import { EXIT_CODES } from '../../../src/cli/exit-codes';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
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

  it('Test maintenance exit code', async () => {
    const serverToken = 'random';
    const apiPath = '/api/v1';
    const apiPort = await getAvailableServerPort(process);
    const fakeServerHost = 'http://' + getFirstIPv4Address() + ':' + apiPort;
    const fakeServerUrl = fakeServerHost + apiPath;
    const fakeServerEnv = {
      ...process.env,
      SNYK_API: fakeServerUrl,
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '1',
    };

    const server = fakeServer(apiPath, serverToken);
    const serverClose = promisify(server.close);
    const serverListen = promisify(server.listen);
    await serverListen(apiPort);

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
    server.setGlobalResponse(
      errorObject,
      parseInt(errorObject['errors'][0].status),
    );

    const { code, stdout } = await runSnykCLI(`test`, {
      env: fakeServerEnv,
    });

    await serverClose();

    expect(stdout).toContain(errorObject['errors'][0].code);
    expect(code).toEqual(EXIT_CODES.EX_TEMPFAIL);
  });
});
