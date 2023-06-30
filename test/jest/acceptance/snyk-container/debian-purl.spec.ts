import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(1000 * 60);

describe('snyk container monitor debian', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
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

  it('constructs debian purls with upstream', async () => {
    await runSnykCLI('container monitor apache/airflow:slim-2.5.3-python3.10');

    expect(server.getRequests()).toHaveLength(1);
    const monitorRequests = server
      .getRequests()
      .filter((request) => request.url?.includes('monitor-dependencies'));

    expect(monitorRequests.length).toEqual(1);
    monitorRequests.forEach((request) => {
      expect(request).toMatchObject({
        body: {
          scanResults: [
            expect.objectContaining({
              /* TODO: match on some purl here */
            }),
          ],
        },
      });
    });
  });
});
