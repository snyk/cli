import { fakeServer } from '../../acceptance/fake-server';
import { createProject } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';
import * as request from '../../../src/lib/request';
import * as fs from 'fs';

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
    jest.restoreAllMocks();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  it('sends correct analytics data for simple command (`snyk version`)', async () => {
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
          integrationName: 'JENKINS',
          integrationVersion: '1.2.3',
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

  // test for `snyk test` with a project that has no vulns
  // improves upon the `snyk version` test because the `snyk test` path will include hitting `analytics.add`
  it('sends correct analytics data for `snyk test` command', async () => {
    const project = await createProject('../acceptance/workspaces/npm-package');
    const { code } = await runSnykCLI('test', {
      cwd: project.path(),
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
          environment: {
            npmVersion: expect.any(String),
          },
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
          nodeVersion: process.version,
          os: expect.any(String),
          standalone: false,
          version: '1.0.0-monorepo',
        },
      },
    });
  });

  // test for `snyk test` when vulns are found
  it('sends correct analytics data for `snyk test` command', async () => {
    const testDepGraphResult = JSON.parse(
      fs.readFileSync(
        'test/fixtures/npm/with-vulnerable-lodash-dep/test-dep-graph-result.json',
        'utf-8',
      ),
    );
    server.setNextResponse(testDepGraphResult);
    const project = await createProject('npm/with-vulnerable-lodash-dep');

    const { code } = await runSnykCLI('test', {
      cwd: project.path(),
      env,
    });

    expect(code).toBe(1);

    const lastRequest = server.popRequest();
    expect(lastRequest).toMatchObject({
      headers: {
        host: 'localhost:12345',
        accept: 'application/json',
        authorization: 'token 123456789',
        'content-type': 'application/json; charset=utf-8',
        'x-snyk-cli-version': '1.0.0-monorepo',
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
          environment: {
            npmVersion: expect.any(String),
          },
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
          nodeVersion: process.version,
          os: expect.any(String),
          standalone: false,
          version: '1.0.0-monorepo',
        },
      },
    });
  });

  // test for a bad command
  it('sends correct analytics data a bad command', async () => {
    const project = await createProject('../acceptance/workspaces/npm-package');
    const { code } = await runSnykCLI('random-nonsense-command --some-option', {
      cwd: project.path(),
      env,
    });

    expect(code).toBe(2);

    const lastRequest = server.popRequest();
    expect(lastRequest).toMatchObject({
      headers: {
        host: 'localhost:12345',
        accept: 'application/json',
        authorization: 'token 123456789',
        'content-type': 'application/json; charset=utf-8',
        'x-snyk-cli-version': '1.0.0-monorepo',
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
          environment: {
            npmVersion: expect.any(String),
          },
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
          nodeVersion: process.version,
          os: expect.any(String),
          standalone: false,
          version: '1.0.0-monorepo',
        },
      },
    });
  });

  // no command, i.e. user enters just `snyk`
  it('sends correct analytics data a bad command', async () => {
    const project = await createProject('../acceptance/workspaces/npm-package');
    const { code } = await runSnykCLI('', {
      cwd: project.path(),
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
      query: {},
      body: {
        data: {
          args: ['help', {}],
          ci: expect.any(Boolean),
          command: 'help',
          durationMs: expect.any(Number),
          environment: {
            npmVersion: expect.any(String),
          },
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
          nodeVersion: process.version,
          os: expect.any(String),
          standalone: false,
          version: '1.0.0-monorepo',
        },
      },
    });
  });

  it("won't send analytics if disable analytics is set", async () => {
    const requestSpy = jest.spyOn(request, 'makeRequest');
    const { code } = await runSnykCLI(`version`, {
      env: {
        ...env,
        SNYK_DISABLE_ANALYTICS: '1',
      },
    });
    expect(code).toBe(0);
    expect(requestSpy).not.toBeCalled();
  });
});
