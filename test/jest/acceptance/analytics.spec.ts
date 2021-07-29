import { fakeServer } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';

describe('analytics module', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
    };

    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  test('validate actual analytics call', async () => {
    server.setNextResponse({});
    const { code } = await runSnykCLI(`version --org=fooOrg --all-projects`, {
      env,
    });
    expect(code).toBe(0);

    const lastRequest = server.popRequest();
    expect(lastRequest).toMatchObject({
      headers: {
        host: 'localhost:12345',
        accept: 'application/json',
        authorization: 'token 123456789',
        'content-type': 'application/json; charset=utf-8',
        'x-snyk-cli-version': '1.0.0-monorepo',
      },
      query: {
        org: 'fooOrg',
      },
      body: {
        data: {
          args: [
            {
              org: 'fooOrg',
              allProjects: true,
            },
          ],
          ci: expect.any(Boolean),
          command: 'version',
          durationMs: expect.any(Number),
          environment: {
            npmVersion: expect.any(String),
          },
          id: expect.any(String),
          integrationEnvironment: '',
          integrationEnvironmentVersion: '',
          integrationName: '',
          integrationVersion: '',
          // prettier-ignore
          metrics: {
            'network_time': {
              type: 'timer',
              values: [],
              total: expect.any(Number),
            },
            'cpu_time': {
              type: 'synthetic',
              values: [expect.any(Number)],
              total: expect.any(Number),
            },
          },
          nodeVersion: process.version,
          org: 'fooOrg',
          os: expect.any(String),
          standalone: false,
          version: '1.0.0-monorepo',
        },
      },
    });
  });
});
