import { fakeServer } from '../../../acceptance/fake-server';
import { getServerPort } from '../../util/getServerPort';
import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(10000 * 60);

describe('--org', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = getServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      DEBUG: 'snyk*',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('orgID is sent to the API', async () => {
    const orgId = '55555555-5555-5555-5555-555555555555';
    const project = await createProjectFromWorkspace('fail-on/no-vulns');

    await runSnykCLI(`monitor --org=${orgId}`, {
      env,
      cwd: project.path(),
    });

    const monitorRequests = server
      .getRequests()
      .filter((request) => request.url?.includes('/monitor/'));

    expect(monitorRequests.length).toBeGreaterThanOrEqual(1);
    monitorRequests.forEach((request) => {
      expect(request).toMatchObject({
        body: {
          meta: {
            org: orgId,
          },
        },
      });
    });
  });

  it('orgID is sent to the API, even if the org slug name is passed as parameter', async () => {
    const orgSlug = 'foobar';
    const orgId = '55555555-5555-5555-5555-555555555555';

    server.setEndpointResponse(
      `/api/rest/orgs?slug=${orgSlug}&version=2024-03-12`,
      {
        jsonapi: {
          version: '1.0',
        },
        data: [
          {
            id: orgId,
            type: 'organization',
            attributes: {
              is_personal: false,
              name: orgSlug,
              slug: orgSlug,
            },
            relationships: {},
          },
        ],
      },
    );
    server.setEndpointStatusCode(
      `/api/rest/orgs?slug=${orgSlug}&version=2024-03-12`,
      200,
    );

    const project = await createProjectFromWorkspace('fail-on/no-vulns');

    await runSnykCLI(`monitor --org=${orgSlug}`, {
      env,
      cwd: project.path(),
    });

    const monitorRequests = server
      .getRequests()
      .filter((request) => request.url?.includes('/monitor/'));

    expect(monitorRequests.length).toBeGreaterThanOrEqual(1);
    monitorRequests.forEach((request) => {
      expect(request).toMatchObject({
        body: {
          meta: {
            org: orgId,
          },
        },
      });
    });
  });
});
