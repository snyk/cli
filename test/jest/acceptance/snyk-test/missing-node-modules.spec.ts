import { fakeServer } from '../../../acceptance/fake-server';
import { getWorkspaceJSON } from '../../../acceptance/workspace-helper';
import { createProject } from '../../util/createProject';
import { requireSnykToken } from '../../util/requireSnykToken';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('snyk test with missing node_modules', () => {
  let server;
  let env: Record<string, string>;
  let noVulnsResult;

  beforeAll((done) => {
    noVulnsResult = getWorkspaceJSON(
      'fail-on',
      'no-vulns',
      'vulns-result.json',
    );
    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
    const BASE_API = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + BASE_API,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: requireSnykToken(),
      SNYK_DISABLE_ANALYTICS: '1',
    };

    const apiKey = '123456789';
    server = fakeServer(BASE_API, apiKey);
    server.listen(port, () => {
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  test('throws when missing node_modules', async () => {
    const project = await createProject('npm/npm-3-no-node-modules');
    const { code, stdout } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });
    expect(stdout).toMatch('Missing node_modules folder');
    expect(code).toEqual(2);
  });

  test('does not throw when missing node_modules & package.json has no dependencies', async () => {
    server.setNextResponse(noVulnsResult);
    const project = await createProject('npm/no-dependencies');
    const { code, stdout } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });
    expect(stdout).toMatch('for known issues, no vulnerable paths found.');
    expect(code).toEqual(0);
  });

  test('does not throw when missing node_modules & package.json has no dependencies (with --dev)', async () => {
    server.setNextResponse(noVulnsResult);
    const project = await createProject('npm/no-dependencies');
    const { code, stdout } = await runSnykCLI('test --dev', {
      cwd: project.path(),
      env,
    });
    expect(stdout).toMatch('for known issues, no vulnerable paths found.');
    expect(code).toEqual(0);
  });
});
