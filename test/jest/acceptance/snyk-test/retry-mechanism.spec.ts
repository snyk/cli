import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { RETRY_ATTEMPTS } from '../../../../src/lib/snyk-test/common';
import { getServerPort } from '../../util/getServerPort';

jest.setTimeout(2000 * 60);

describe('snyk test retry mechanism', () => {
  let server;
  let env: Record<string, string>;
  const baseApi = '/api/v1';
  const ipAddress = getFirstIPv4Address();

  beforeAll((done) => {
    const port = getServerPort(process);
    env = {
      ...process.env,
      SNYK_API: `http://${ipAddress}:${port}${baseApi}`,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
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

  test('run `snyk test` on an arbitrary cocoapods project and expect retries in case of failures', async () => {
    const project = await createProjectFromWorkspace('cocoapods-app');
    const statuses = Array(RETRY_ATTEMPTS - 1).fill(500);
    server.setEndpointStatusCodes(baseApi + '/test-dep-graph', statuses);

    const { code } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
  });

  test('run `snyk test` on an arbitrary cocoapods project and expect failure when the retry budget is consumed', async () => {
    const project = await createProjectFromWorkspace('cocoapods-app');
    server.setEndpointStatusCode(baseApi + '/test-dep-graph', 500);
    server.setEndpointResponse(baseApi + '/test-dep-graph', 'error');

    const { code } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(2);
  });
});
