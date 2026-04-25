import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getAvailableServerPort } from '../util/getServerPort';
import { Snyk } from '@snyk/error-catalog-nodejs-public';
import { EXIT_CODES } from '../../../src/cli/exit-codes';
import { getCliConfig, restoreCliConfig } from '../../acceptance/config-helper';

jest.setTimeout(1000 * 30);

describe('maintenance error [SNYK-0099]', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let initialConfig: Record<string, string> = {};

  const maintenanceErrorRes = {
    jsonapi: { version: '1.0' },
    errors: [new Snyk.MaintenanceWindowError('').toJsonApiErrorObject()],
    description: 'Maintenance window',
  };

  beforeAll(async () => {
    const ipAddr = getFirstIPv4Address();
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';

    env = {
      ...process.env,
      SNYK_API: 'http://' + ipAddr + ':' + port + baseApi,
      SNYK_TOKEN: '123456789',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '1',
      INTERNAL_NETWORK_REQUEST_RETRY_AFTER_SECONDS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        resolve();
      });
    });
  });

  beforeEach(async () => {
    initialConfig = await getCliConfig();
    server.setGlobalResponse(
      maintenanceErrorRes,
      parseInt(maintenanceErrorRes.errors[0].status),
    );
  });

  afterEach(async () => {
    server.restore();
    await restoreCliConfig(initialConfig);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  it('does not attempt any retries', async () => {
    await runSnykCLI(`test -d --log-level=trace`, {
      env: {
        ...env,
        // apply a user configured attempts of 10
        INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '10',
      },
    });

    // Count how many times an endpoint was hit
    const requests = server.getRequests();
    const actualNetworkAttempts = requests.filter(
      (r) => r.url.includes('/test-dep-graph') || r.url.includes('/vuln/'),
    ).length;

    expect(actualNetworkAttempts).toBe(1);
  });

  it.each([
    ['test'],
    ['container test scratch'],
    ['container monitor scratch'],
    ['iac test'],
    ['code test'],
    ['secrets test'],
    ['monitor'],
    ['whoami'],
    ['auth 11111111-2222-3333-4444-555555555555'],
    ['sbom --org=test-org --format=cyclonedx1.4+json'],
    ['container sbom scratch --format=cyclonedx1.4+json'],
    ['sbom test --experimental --file=package.json'],
    ['aibom test --experimental'],
  ])('returns correct exit code for "%s"', async (args) => {
    const { code, stdout } = await runSnykCLI(args, {
      env,
    });

    expect(stdout).toContain(maintenanceErrorRes['errors'][0].code);
    expect(code).toEqual(EXIT_CODES.EX_TEMPFAIL);
  });
});
