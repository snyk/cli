import { createProject } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(1000 * 60);

describe('trust policies', () => {
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
      SNYK_DISABLE_ANALYTICS: '1',
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
    server.close(() => {
      done();
    });
  });

  test('`snyk test` detects suggested ignore policies', async () => {
    const project = await createProject('qs-package');
    server.setDepGraphResponse(
      await project.readJSON('test-dep-graph-result.json'),
    );

    const { code, stdout } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(1);
    expect(stdout).toMatch(
      'suggests ignoring this issue, with reason: test trust policies',
    );
    expect(stdout).toMatch('npm:hawk:20160119');
    expect(stdout).toMatch('npm:request:20160119');
  });

  test('`snyk test --trust-policies` applies suggested ignore policies', async () => {
    const project = await createProject('qs-package');
    server.setDepGraphResponse(
      await project.readJSON('test-dep-graph-result-trust-policies.json'),
    );

    const { code, stdout } = await runSnykCLI('test --trust-policies', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(1);
    expect(stdout).not.toMatch(
      'suggests ignoring this issue, with reason: test trust policies',
    );
    expect(stdout).not.toMatch('npm:hawk:20160119');
    expect(stdout).not.toMatch('npm:request:20160119');
  });
});
