import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { getServerPort } from '../../util/getServerPort';
import { tmpdir } from 'os';
process.env.SNYK_ERR_FILE = tmpdir() + '/tmp_err_file.txt';
jest.setTimeout(1000 * 60);

describe('--target-reference', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  beforeEach(() => {
    process.env.SNYK_ERR_FILE = tmpdir() + '/tmp_err_file.txt';
  });

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

  it('forwards value to container monitor endpoint', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    const { code } = await runSnykCLI(
      'container monitor debian --target-reference=test-target-ref',
      {
        env,
        cwd: project.path(),
      },
    );

    expect(code).toEqual(0);

    const monitorRequests = server
      .getRequests()
      .filter((request) => request.url?.includes('/monitor-dependencies'));

    expect(monitorRequests.length).toBeGreaterThanOrEqual(1);
    monitorRequests.forEach((request) => {
      expect(request.body.scanResult.targetReference).toEqual(
        'test-target-ref',
      );
    });
  });

  it('forwards value to test endpoint', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    const { code } = await runSnykCLI(
      'container test debian --target-reference=test-target-ref',
      {
        env,
        cwd: project.path(),
      },
    );
    expect(code).toEqual(0);

    const testRequests = server
      .getRequests()
      .filter((request) => request.url?.includes('/test-dependencies'));

    expect(testRequests.length).toBeGreaterThanOrEqual(1);
    testRequests.forEach((request) => {
      expect(request.body.scanResult.targetReference).toEqual(
        'test-target-ref',
      );
    });
  });
});
