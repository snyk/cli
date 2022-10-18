import { fakeServer } from '../../acceptance/fake-server';
import { createProjectFromFixture } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';
import * as path from 'path';

jest.setTimeout(1000 * 30);

describe('`test` command with `--print-graph` option', () => {
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

  // test cases for `--print-graph` option:
  // graph with for project with no vulns
  // graph with for project with vulns
  // graph with for project with vulns and --all-projects

  it('works for project with no deps', async () => {
    const project = await createProjectFromFixture('print-graph-no-deps');
    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    expect(stdout).toContain('DepGraph data:');
    expect(stdout).toContain('DepGraph target:\npackage.json\nDepGraph end');

    const jsonDGStr = stdout
      .split('DepGraph data:')[1]
      .split('DepGraph target:')[0];
    const jsonDG = JSON.parse(jsonDGStr);
    expect(jsonDG).toMatchObject({
      pkgManager: {
        name: 'npm',
      },
      pkgs: [
        {
          id: 'print-graph-no-deps@1.0.0',
          info: {
            name: 'print-graph-no-deps',
            version: '1.0.0',
          },
        },
      ],
      graph: {
        rootNodeId: 'root-node',
        nodes: [
          {
            nodeId: 'root-node',
            pkgId: 'print-graph-no-deps@1.0.0',
            deps: [],
          },
        ],
      },
    });
  });

  it('works for project with dep', async () => {
    const project = await createProjectFromFixture(
      'npm/with-vulnerable-lodash-dep',
    );
    server.setDepGraphResponse(
      await project.readJSON('test-dep-graph-result.json'),
    );
    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    expect(stdout).toContain('DepGraph data:');
    expect(stdout).toContain(
      'DepGraph target:\npackage-lock.json\nDepGraph end',
    );

    const jsonDGStr = stdout
      .split('DepGraph data:')[1]
      .split('DepGraph target:')[0];
    const jsonDG = JSON.parse(jsonDGStr);
    expect(jsonDG).toMatchObject({
      pkgManager: {
        name: 'npm',
      },
      pkgs: [
        {
          id: 'with-vulnerable-lodash-dep@1.2.3',
          info: {
            name: 'with-vulnerable-lodash-dep',
            version: '1.2.3',
          },
        },
        {
          id: 'lodash@4.17.15',
          info: {
            name: 'lodash',
            version: '4.17.15',
          },
        },
      ],
      graph: {
        rootNodeId: 'root-node',
        nodes: [
          {
            nodeId: 'root-node',
            pkgId: 'with-vulnerable-lodash-dep@1.2.3',
            deps: [
              {
                nodeId: 'lodash@4.17.15',
              },
            ],
          },
          {
            nodeId: 'lodash@4.17.15',
            pkgId: 'lodash@4.17.15',
            deps: [],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
        ],
      },
    });
  });

  it('works with `--all-projects`', async () => {
    const project = await createProjectFromFixture(
      'print-graph-multiple-projects',
    );
    const { code, stdout } = await runSnykCLI(
      'test --all-projects --print-graph',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);

    const proj1Path = path.join('proj1', 'package.json');
    expect(stdout).toContain(`DepGraph target:\n${proj1Path}\nDepGraph end`);

    const proj2Path = path.join('proj2', 'package.json');
    expect(stdout).toContain(`DepGraph target:\n${proj2Path}\nDepGraph end`);

    const jsonDGStrProj1 = stdout
      .split('DepGraph data:')[1]
      .split('DepGraph target:')[0];
    const jsonDGProj1 = JSON.parse(jsonDGStrProj1);
    expect(jsonDGProj1).toMatchObject({
      pkgManager: {
        name: 'npm',
      },
      pkgs: [
        {
          id: 'proj1@1.0.0',
          info: {
            name: 'proj1',
            version: '1.0.0',
          },
        },
      ],
      graph: {
        rootNodeId: 'root-node',
        nodes: [
          {
            nodeId: 'root-node',
            pkgId: 'proj1@1.0.0',
            deps: [],
          },
        ],
      },
    });

    const jsonDGStrProj2 = stdout
      .split('DepGraph end')[1]
      .split('DepGraph data:')[1]
      .split('DepGraph target:')[0];
    const jsonDGProj2 = JSON.parse(jsonDGStrProj2);
    expect(jsonDGProj2).toMatchObject({
      pkgManager: {
        name: 'npm',
      },
      pkgs: [
        {
          id: 'proj2@1.0.0',
          info: {
            name: 'proj2',
            version: '1.0.0',
          },
        },
      ],
      graph: {
        rootNodeId: 'root-node',
        nodes: [
          {
            nodeId: 'root-node',
            pkgId: 'proj2@1.0.0',
            deps: [],
          },
        ],
      },
    });
  });
});
