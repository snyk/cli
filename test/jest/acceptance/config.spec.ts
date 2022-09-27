import { fakeServer } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';

describe('config', () => {
  let server: ReturnType<typeof fakeServer>;
  const port = process.env.PORT || process.env.SNYK_PORT || '12345';
  const baseURL = '/realbase';
  const orgId = '4e0828f9-d92a-4f54-b005-6b9d8150b75f';
  const testData = {
    appName: 'Test',
    redirectURIs: 'https://example.com,https://example1.com',
    scopes: 'org.read',
    orgId,
  };

  beforeAll(() => {
    server = fakeServer(baseURL, '123456789');
    return new Promise<void>((resolve) => server.listen(port, resolve));
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll(() => new Promise<void>(server.close));

  it('loads API_REST_URL from config key if set', async () => {
    const env = {
      ...process.env,
      SNYK_API_REST_URL: 'http://localhost:' + port + baseURL,
    };

    const {
      code,
    } = await runSnykCLI(
      `apps create --org=${testData.orgId} --name=${testData.appName} --redirect-uris=${testData.redirectURIs} --scopes=${testData.scopes} --experimental`,
      { env },
    );

    expect(code).toBe(0);
  });

  it('fails with incorrect base url for sanity check', async () => {
    const env = {
      ...process.env,
      SNYK_API_REST_URL: 'http://localhost:' + port + '/wrongbase',
    };

    const {
      code,
    } = await runSnykCLI(
      `apps create --org=${testData.orgId} --name=${testData.appName} --redirect-uris=${testData.redirectURIs} --scopes=${testData.scopes} --experimental`,
      { env },
    );

    expect(code).not.toBe(0);
  });

  it('loads API_REST_URL from API_V3_URL if set', async () => {
    const env = {
      ...process.env,
      SNYK_API_V3_URL: 'http://localhost:' + port + baseURL,
    };

    const {
      code,
    } = await runSnykCLI(
      `apps create --org=${testData.orgId} --name=${testData.appName} --redirect-uris=${testData.redirectURIs} --scopes=${testData.scopes} --experimental`,
      { env },
    );

    expect(code).toBe(0);
  });

  it('prefers API_V3_URL over API_REST_URL when both are set', async () => {
    const env = {
      ...process.env,
      SNYK_API_REST_URL: 'http://localhost:' + port + '/wrongbase',
      SNYK_API_V3_URL: 'http://localhost:' + port + baseURL,
    };

    const {
      code,
    } = await runSnykCLI(
      `apps create --org=${testData.orgId} --name=${testData.appName} --redirect-uris=${testData.redirectURIs} --scopes=${testData.scopes} --experimental`,
      { env },
    );

    expect(code).toBe(0);
  });
});
