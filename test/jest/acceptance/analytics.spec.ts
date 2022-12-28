import { fakeServer } from '../../acceptance/fake-server';
import {
  createProjectFromFixture,
  createProjectFromWorkspace,
} from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';
import { isCLIV2 } from '../util/isCLIV2';

jest.setTimeout(1000 * 30);

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
      SNYK_INTEGRATION_NAME: 'JENKINS',
      SNYK_INTEGRATION_VERSION: '1.2.3',
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

  it('sends analytics for `snyk test` with no vulns found', async () => {
    const project = await createProjectFromWorkspace('npm-package');
    const { code } = await runSnykCLI('test --debug', {
      cwd: project.path(),
      env,
    });

    expect(code).toBe(0);

    const requests = server.getRequests().filter((value) => {
      return value.url == '/api/v1/analytics/cli';
    });

    if (isCLIV2()) {
      // in this case an extra analytics event is being sent, which needs to be dropped
      requests.pop();
    }

    const lastRequest = requests.pop();

    expect(lastRequest).toMatchObject({
      headers: {
        host: 'localhost:12345',
        accept: 'application/json',
        authorization: 'token 123456789',
        'content-type': 'application/json; charset=utf-8',
        'x-snyk-cli-version': expect.stringMatching(/^(\d+\.){2}.*/),
      },
      query: {},
      body: {
        data: {
          args: [{}],
          ci: expect.any(Boolean),
          command: 'test',
          metadata: {
            pluginName: 'snyk-nodejs-lockfile-parser',
            packageManager: 'npm',
            packageName: 'npm-package',
            packageVersion: '1.0.0',
            isDocker: false,
            depGraph: true,
            vulns: 0,
          },
          durationMs: expect.any(Number),
          id: expect.any(String),
          integrationEnvironment: '',
          integrationEnvironmentVersion: '',
          integrationName: 'JENKINS',
          integrationVersion: '1.2.3',
          // prettier-ignore
          metrics: {
            'network_time': {
              type: 'timer',
              values: expect.any(Array),
              total: expect.any(Number),
            },
            'cpu_time': {
              type: 'synthetic',
              values: [expect.any(Number)],
              total: expect.any(Number),
            },
          },
          nodeVersion: expect.any(String),
          os: expect.any(String),
          standalone: expect.any(Boolean),
          version: expect.stringMatching(/^(\d+\.){2}.*/),
        },
      },
    });
  });

  it('sends analytics for `snyk test` with vulns found', async () => {
    const project = await createProjectFromFixture(
      'npm/with-vulnerable-lodash-dep',
    );
    server.setDepGraphResponse(
      await project.readJSON('test-dep-graph-result.json'),
    );

    const { code } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });

    expect(code).toBe(1);

    const requests = server.getRequests().filter((value) => {
      return value.url == '/api/v1/analytics/cli';
    });

    if (isCLIV2()) {
      // in this case an extra analytics event is being sent, which needs to be dropped
      requests.pop();
    }

    const lastRequest = requests.pop();
    expect(lastRequest).toMatchObject({
      headers: {
        host: 'localhost:12345',
        accept: 'application/json',
        authorization: 'token 123456789',
        'content-type': 'application/json; charset=utf-8',
        'x-snyk-cli-version': expect.stringMatching(/^(\d+\.){2}.*/),
      },
      query: {},
      body: {
        data: {
          args: [{}],
          ci: expect.any(Boolean),
          command: 'test',
          metadata: {
            'generating-node-dependency-tree': {
              lockFile: true,
              targetFile: 'package-lock.json',
            },
            lockfileVersion: 2,
            pluginName: 'snyk-nodejs-lockfile-parser',
            packageManager: 'npm',
            packageName: 'with-vulnerable-lodash-dep',
            packageVersion: '1.2.3',
            prePrunedPathsCount: 2,
            depGraph: true,
            isDocker: false,
            'vulns-pre-policy': 5,
            vulns: 5,
            actionableRemediation: true,
            'error-code': 'VULNS',
            'error-message': 'Vulnerabilities found',
          },
          durationMs: expect.any(Number),
          id: expect.any(String),
          integrationEnvironment: '',
          integrationEnvironmentVersion: '',
          integrationName: 'JENKINS',
          integrationVersion: '1.2.3',
          // prettier-ignore
          metrics: {
            'network_time': {
              type: 'timer',
              values: expect.any(Array),
              total: expect.any(Number),
            },
            'cpu_time': {
              type: 'synthetic',
              values: [expect.any(Number)],
              total: expect.any(Number),
            },
          },
          nodeVersion: expect.any(String),
          os: expect.any(String),
          standalone: expect.any(Boolean),
          version: expect.stringMatching(/^(\d+\.){2}.*/),
        },
      },
    });
  });

  it('sends correct analytics data a bad command', async () => {
    const project = await createProjectFromWorkspace('npm-package');
    const { code } = await runSnykCLI('random-nonsense-command --some-option', {
      cwd: project.path(),
      env,
    });

    expect(code).toBe(2);

    const requests = server.getRequests().filter((value) => {
      return value.url == '/api/v1/analytics/cli';
    });

    if (isCLIV2()) {
      // in this case an extra analytics event is being sent, which needs to be dropped
      requests.pop();
    }

    const lastRequest = requests.pop();
    expect(lastRequest).toMatchObject({
      headers: {
        host: 'localhost:12345',
        accept: 'application/json',
        authorization: 'token 123456789',
        'content-type': 'application/json; charset=utf-8',
        'x-snyk-cli-version': expect.stringMatching(/^(\d+\.){2}.*/),
      },
      query: {},
      body: {
        data: {
          args: ['random-nonsense-command'],
          ci: expect.any(Boolean),
          command: 'bad-command',
          metadata: {
            command: 'random-nonsense-command',
            error: expect.stringContaining(
              'Error: Unknown command "random-nonsense-command"',
            ),
            'error-code': 'UNKNOWN_COMMAND',
            'error-message': 'Unknown command "random-nonsense-command"',
          },
          durationMs: expect.any(Number),
          id: expect.any(String),
          integrationEnvironment: '',
          integrationEnvironmentVersion: '',
          integrationName: 'JENKINS',
          integrationVersion: '1.2.3',
          // prettier-ignore
          metrics: {
            'network_time': {
              type: 'timer',
              values: expect.any(Array),
              total: expect.any(Number),
            },
            'cpu_time': {
              type: 'synthetic',
              values: [expect.any(Number)],
              total: expect.any(Number),
            },
          },
          nodeVersion: expect.any(String),
          os: expect.any(String),
          standalone: expect.any(Boolean),
          version: expect.stringMatching(/^(\d+\.){2}.*/),
        },
      },
    });
  });

  it('sends correct analytics with error-details containing 403 error body', async () => {
    server.setNextResponse({ error: 'Unauthorized' });
    server.setNextStatusCode(403);

    const project = await createProjectFromFixture(
      'npm/with-vulnerable-lodash-dep',
    );

    const { code } = await runSnykCLI('test --org=1234', {
      cwd: project.path(),
      env,
    });

    expect(code).toBe(2);

    const requests = server.getRequests().filter((value) => {
      return value.url.includes('/api/v1/analytics/cli');
    });

    if (isCLIV2()) {
      // in this case an extra analytics event is being sent, which needs to be dropped
      requests.pop();
    }

    const lastRequest = requests.pop();
    expect(lastRequest).toMatchObject({
      query: {},
      body: {
        data: {
          args: [{}],
          ci: expect.any(Boolean),
          command: 'bad-command',
          metadata: {
            'generating-node-dependency-tree': {
              lockFile: true,
              targetFile: 'package-lock.json',
            },
            lockfileVersion: 2,
            pluginName: 'snyk-nodejs-lockfile-parser',
            packageManager: 'npm',
            packageName: 'with-vulnerable-lodash-dep',
            packageVersion: '1.2.3',
            prePrunedPathsCount: 2,
            'error-code': 403,
            'error-message': expect.stringContaining(
              'Authentication failed. Please check the API token on',
            ),
            'error-details': { error: 'Unauthorized' },
          },
          durationMs: expect.any(Number),
          id: expect.any(String),
          integrationEnvironment: '',
          integrationEnvironmentVersion: '',
          integrationName: 'JENKINS',
          integrationVersion: '1.2.3',
          // prettier-ignore
          metrics: {
            'network_time': {
              type: 'timer',
              values: expect.any(Array),
              total: expect.any(Number),
            },
            'cpu_time': {
              type: 'synthetic',
              values: [expect.any(Number)],
              total: expect.any(Number),
            },
          },
          nodeVersion: expect.any(String),
          os: expect.any(String),
          standalone: expect.any(Boolean),
          version: expect.stringMatching(/^(\d+\.){2}.*/),
        },
      },
    });
  });

  it('sends analytics data a bad command', async () => {
    const project = await createProjectFromWorkspace('npm-package');
    const { code } = await runSnykCLI('', {
      cwd: project.path(),
      env,
    });

    expect(code).toBe(0);

    const requests = server.getRequests().filter((value) => {
      return value.url == '/api/v1/analytics/cli';
    });

    if (isCLIV2()) {
      // in this case an extra analytics event is being sent, which needs to be dropped
      requests.pop();
    }

    const lastRequest = requests.pop();
    expect(lastRequest).toMatchObject({
      headers: {
        host: 'localhost:12345',
        accept: 'application/json',
        authorization: 'token 123456789',
        'content-type': 'application/json; charset=utf-8',
        'x-snyk-cli-version': expect.stringMatching(/^(\d+\.){2}.*/),
      },
      query: {},
      body: {
        data: {
          args: ['help', {}],
          ci: expect.any(Boolean),
          command: 'help',
          durationMs: expect.any(Number),
          id: expect.any(String),
          integrationEnvironment: '',
          integrationEnvironmentVersion: '',
          integrationName: 'JENKINS',
          integrationVersion: '1.2.3',
          // prettier-ignore
          metrics: {
            'network_time': {
              type: 'timer',
              values: expect.any(Array),
              total: expect.any(Number),
            },
            'cpu_time': {
              type: 'synthetic',
              values: [expect.any(Number)],
              total: expect.any(Number),
            },
          },
          nodeVersion: expect.any(String),
          os: expect.any(String),
          standalone: expect.any(Boolean),
          version: expect.stringMatching(/^(\d+\.){2}.*/),
        },
      },
    });
  });

  it('sends analytics data with basic check only', async () => {
    const project = await createProjectFromWorkspace('npm-package');
    const { code } = await runSnykCLI('', {
      cwd: project.path(),
      env,
    });

    expect(code).toBe(0);

    const lastRequest = server.popRequest();
    expect(lastRequest).toMatchObject({
      headers: {
        host: 'localhost:12345',
        'content-length': expect.any(String),
        authorization: 'token 123456789',
        'content-type': 'application/json; charset=utf-8',
        'x-snyk-cli-version': expect.stringMatching(/^(\d+\.){2}.*/),
      },
      query: {},
      body: {
        data: {
          args: expect.any(Array),
          ci: expect.any(Boolean),
          command: expect.any(String),
          durationMs: expect.any(Number),
          id: expect.any(String),
          integrationEnvironment: '',
          integrationEnvironmentVersion: '',
          integrationName: 'JENKINS',
          integrationVersion: '1.2.3',
          // prettier-ignore
          metrics: expect.any(Object),
          nodeVersion: expect.any(String),
          os: expect.any(String),
          standalone: expect.any(Boolean),
          version: expect.stringMatching(/^(\d+\.){2}.*/),
        },
      },
    });
  });

  it('uses OAUTH token if set', async () => {
    const project = await createProjectFromWorkspace('npm-package');
    const { code } = await runSnykCLI('test woof', {
      cwd: project.path(),
      env: {
        ...env,
        SNYK_OAUTH_TOKEN: 'oauth-jwt-token',
      },
    });
    expect(code).toBe(0);

    const lastRequest = server.popRequest();
    expect(lastRequest).toMatchObject({
      headers: {
        authorization: 'Bearer oauth-jwt-token',
      },
    });
  });

  it("won't send analytics if disable analytics is set", async () => {
    const { code } = await runSnykCLI(`version`, {
      env: {
        ...env,
        SNYK_DISABLE_ANALYTICS: '1',
      },
    });
    expect(code).toBe(0);

    const requests = server.getRequests().filter((value) => {
      return value.url == '/api/v1/analytics/cli';
    });

    const lastRequest = requests.pop();
    expect(lastRequest).toBeUndefined();
  });
});
