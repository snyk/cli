import { runSnykCLI } from '../../util/runSnykCLI';
import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { resolve } from 'path';

jest.setTimeout(1000 * 60);

describe('snyk redteam (mocked servers only)', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let redteamTarget: string;
  const projectRoot = resolve(__dirname, '../../../..');

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '58584';
    const baseApi = '/api/v1';
    const ipAddr = getFirstIPv4Address();
    redteamTarget = resolve(projectRoot, 'test/fixtures/redteam/redteam.yaml');
    env = {
      ...process.env,
      SNYK_API: 'http://' + ipAddr + ':' + port + baseApi,
      SNYK_HOST: 'http://' + ipAddr + ':' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_CFG_ORG: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
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
});
