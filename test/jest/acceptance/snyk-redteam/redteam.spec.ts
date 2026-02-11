import { runSnykCLI } from '../../util/runSnykCLI';
import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { resolve } from 'path';
import { getAvailableServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('snyk redteam (mocked servers only)', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let redteamTarget: string;
  let redteamTargetWithAgent: string;
  const projectRoot = resolve(__dirname, '../../../..');

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';
    const ipAddr = getFirstIPv4Address();
    redteamTarget = resolve(projectRoot, 'test/fixtures/redteam/redteam.yaml');
    redteamTargetWithAgent = resolve(
      projectRoot,
      'test/fixtures/redteam/redteam_with_agent.yaml',
    );
    env = {
      ...process.env,
      SNYK_API: 'http://' + ipAddr + ':' + port + baseApi,
      SNYK_HOST: 'http://' + ipAddr + ':' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_CFG_ORG: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  test('`redteam` generates a redteam report', async () => {
    expect(server.getRequests().length).toEqual(0);
    const { code, stdout } = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental`,
      {
        env,
      },
    );
    let report: any;

    expect(code).toEqual(0);
    expect(() => {
      report = JSON.parse(stdout);
    }).not.toThrow();

    const all_requests = server.getRequests().map((req) => req.url);
    const red_teaming_requests = all_requests.filter((req) =>
      req.includes('/ai_scans'),
    );

    expect(red_teaming_requests.length).toEqual(3);

    expect(report).toMatchObject({
      id: expect.any(String),
      results: expect.arrayContaining([
        {
          definition: {
            description: expect.any(String),
            id: expect.any(String),
            name: expect.any(String),
          },
          evidence: {
            content: {
              reason: expect.any(String),
            },
            type: expect.any(String),
          },
          id: expect.any(String),
          severity: expect.any(String),
          url: expect.any(String),
        },
      ]),
    });
  });

  test('`redteam` fails if configuration is invalid', async () => {
    const invalidRedteamTarget = resolve(
      projectRoot,
      'test/fixtures/redteam/redteam_invalid.yaml',
    );
    const { code, stdout } = await runSnykCLI(
      `redteam --config=${invalidRedteamTarget} --experimental`,
      {
        env,
      },
    );
    expect(code).toEqual(2);
    expect(stdout).toContain('CLI validation failure');
  });

  /**
   * TODO(pkey): when running the tests, underlying go framework is NOT converting http errors to Snyk Errors.
   * As a result, locally or in CI, this test doesn't go through the same error handling path.
   * This needs to be addressed either by handling both cases equally in the cli extension or
   * by fixing the framework to be consistent across all environments.
   *
   * Leaving this test disabled so that it can be enabled when underlying issue is fixed.
   */
  test.skip('`redteam` displays a 400 error properly', async () => {
    server.setStatusCode(400);
    server.setEndpointResponse('/api/v1/ai_scans', {
      errors: [
        {
          status: '400',
          detail: 'This is the error message',
          title: 'Bad Request',
        },
      ],
    });
    const { code, stdout } = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental`,
      {
        env,
      },
    );
    expect(code).toEqual(2);
    expect(stdout).toContain('400');
    expect(stdout).toContain('This is the error message');
  });

  test('`redteam` can run a redteam scan with a scanning agent', async () => {
    const { code } = await runSnykCLI(
      `redteam --config=${redteamTargetWithAgent} --experimental`,
      {
        env,
      },
    );
    expect(code).toEqual(0);
  });

  test('`redteam scanning-agent` can list scanning agents', async () => {
    const { code, stdout } = await runSnykCLI(
      `redteam scanning-agent --experimental`,
      {
        env,
      },
    );
    expect(code).toEqual(0);
    const agents = JSON.parse(stdout);
    expect(agents).toEqual(
      expect.arrayContaining([
        {
          id: expect.any(String),
          name: expect.any(String),
          online: expect.any(Boolean),
          fallback: expect.any(Boolean),
          rx_bytes: expect.any(Number),
          tx_bytes: expect.any(Number),
          latest_handshake: expect.any(Number),
          installer_generated: expect.any(Boolean),
        },
      ]),
    );
  });

  test('`redteam` can add scanning agents', async () => {
    const { code, stdout } = await runSnykCLI(
      `redteam scanning-agent create --experimental`,
      {
        env,
      },
    );
    expect(code).toEqual(0);

    expect(stdout).toContain('Agent Token:');
    expect(stdout).toContain('The token will only be displayed once');
    expect(stdout).toContain('Installation');
    expect(stdout).toContain('Docker:');
    expect(stdout).toContain('docker run');
    expect(stdout).toContain('probely/farcaster-onprem-agent');

    const lastBraceIndex = stdout.lastIndexOf('{');
    expect(lastBraceIndex).toBeGreaterThan(-1);
    const jsonString = stdout.substring(lastBraceIndex).trim();
    const agent = JSON.parse(jsonString);
    expect(agent).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      online: expect.any(Boolean),
      fallback: expect.any(Boolean),
      rx_bytes: expect.any(Number),
      tx_bytes: expect.any(Number),
      latest_handshake: expect.any(Number),
      installer_generated: expect.any(Boolean),
    });
  });

  test('`redteam` can remove scanning agents', async () => {
    const { code } = await runSnykCLI(
      `redteam scanning-agent delete --experimental --id=59622253-75f3-4439-ac1e-ce94834c5804`,
      {
        env,
      },
    );
    expect(code).toEqual(0);
  });

  test('`redteam get` retrieves scan results', async () => {
    const { code, stdout } = await runSnykCLI(
      `redteam get --experimental --id=59622253-75f3-4439-ac1e-ce94834c5804`,
      {
        env,
      },
    );
    expect(code).toEqual(0);

    let report: any;
    expect(() => {
      report = JSON.parse(stdout);
    }).not.toThrow();

    expect(report).toMatchObject({
      id: expect.any(String),
      results: expect.arrayContaining([
        {
          id: expect.any(String),
          severity: expect.any(String),
          definition: {
            id: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
          },
          url: expect.any(String),
          evidence: {
            content: {
              reason: expect.any(String),
            },
            type: expect.any(String),
          },
        },
      ]),
    });
  });

  test('`redteam get` fails without --id flag', async () => {
    const { code, stdout } = await runSnykCLI(`redteam get --experimental`, {
      env,
    });
    expect(code).toEqual(2);
    expect(stdout).toContain('No scan ID');
  });

  test('`redteam get` fails with invalid UUID', async () => {
    const { code, stdout } = await runSnykCLI(
      `redteam get --experimental --id=not-a-uuid`,
      {
        env,
      },
    );
    expect(code).toEqual(2);
    expect(stdout).toContain('not a valid UUID');
  });
});
