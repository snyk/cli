import { fakeServer } from '../../acceptance/fake-server';
import { createProjectFromFixture } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';
import { getServerPort } from '../util/getServerPort';
import { ProblemError } from '@snyk/error-catalog-nodejs-public';
import * as path from 'path';

jest.setTimeout(1000 * 30);

describe('`test` command with `--print-graph-with-errors` option', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = getServerPort(process);
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

  it('works for project with no deps', async () => {
    const project = await createProjectFromFixture('print-graph-no-deps');
    const { code, stdout } = await runSnykCLI(
      'test --print-graph-with-errors',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);

    const jsonOutput = JSON.parse(stdout);

    expect(jsonOutput.normalisedTargetFile).toBe('package.json');
    expect(jsonOutput.depGraph).toMatchObject({
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
    server.setCustomResponse(
      await project.readJSON('test-dep-graph-result.json'),
    );
    const { code, stdout } = await runSnykCLI(
      'test --print-graph-with-errors',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);

    const jsonOutput = JSON.parse(stdout);

    expect(jsonOutput.normalisedTargetFile).toBe('package-lock.json');
    expect(jsonOutput.depGraph).toMatchObject({
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
      'test --all-projects --print-graph-with-errors',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);

    const lines = stdout
      .trim()
      .split('\n')
      .filter((line) => line.trim());
    expect(lines.length).toBeGreaterThan(0);

    const jsonOutputFirstProject = JSON.parse(lines[0]);

    expect(jsonOutputFirstProject).toHaveProperty('depGraph');
    expect(jsonOutputFirstProject).toHaveProperty('normalisedTargetFile');

    expect(jsonOutputFirstProject.depGraph).toMatchObject({
      pkgManager: {
        name: 'npm',
      },
      pkgs: expect.arrayContaining([
        expect.objectContaining({
          info: expect.objectContaining({
            name: expect.stringMatching(/proj[12]/),
          }),
        }),
      ]),
      graph: {
        rootNodeId: 'root-node',
        nodes: expect.any(Array),
      },
    });
    expect(jsonOutputFirstProject.normalisedTargetFile).toBe(
      path.join('proj1', 'package.json'),
    );

    const jsonOutputSecondProject = JSON.parse(lines[1]);

    expect(jsonOutputSecondProject).toHaveProperty('depGraph');
    expect(jsonOutputSecondProject).toHaveProperty('normalisedTargetFile');

    expect(jsonOutputSecondProject.depGraph).toMatchObject({
      pkgManager: {
        name: 'npm',
      },
    });
    expect(jsonOutputSecondProject.normalisedTargetFile).toBe(
      path.join('proj2', 'package.json'),
    );
  });

  it('outputs both error JSON and dep graphs for mixed success/failure with --all-projects', async () => {
    const project = await createProjectFromFixture(
      'print-graph-mixed-success-failure',
    );
    server.setCustomResponse(
      await project.readJSON('valid-project/test-dep-graph-result.json'),
    );
    const { code, stdout, stderr } = await runSnykCLI(
      'test --all-projects --print-graph-with-errors',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toBe(0);

    const lines = stdout
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    const jsonObjects: any[] = [];
    for (const line of lines) {
      try {
        jsonObjects.push(JSON.parse(line));
      } catch {
        // Skip non-JSON lines
      }
    }

    expect(jsonObjects.length).toBeGreaterThan(0);

    const errorOutputs = jsonObjects.filter(
      (obj) =>
        obj.error !== undefined && obj.normalisedTargetFile !== undefined,
    );
    const successOutputs = jsonObjects.filter(
      (obj) => obj.depGraph !== undefined,
    );

    expect(errorOutputs.length).toBeGreaterThanOrEqual(1);

    for (const errorOutput of errorOutputs) {
      expect(errorOutput).toHaveProperty('normalisedTargetFile');

      const problemErrors = ProblemError.fromJsonApi(errorOutput.error);
      expect(problemErrors.length).toBe(1);
      const problemError = problemErrors[0];

      expect(problemError).toHaveProperty(
        'metadata.errorCode',
        'SNYK-CLI-0000',
      );
      expect(problemError).toHaveProperty('metadata.title');
      expect(problemError).toHaveProperty('detail');
      expect(problemError.detail).toMatch(/Error:/);
      expect(problemError.detail).toContain(errorOutput.normalisedTargetFile);
    }

    expect(successOutputs.length).toBeGreaterThanOrEqual(1);

    for (const successOutput of successOutputs) {
      expect(successOutput).toHaveProperty('depGraph');
      expect(successOutput).toHaveProperty('normalisedTargetFile');
      expect(successOutput.depGraph).toHaveProperty('pkgManager');
    }

    expect(stderr).toMatch(/failed to get dependencies/i);
  });

  it('does not use legacy text format', async () => {
    const project = await createProjectFromFixture('print-graph-no-deps');
    const { code, stdout } = await runSnykCLI(
      'test --print-graph-with-errors',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(stdout).not.toContain('DepGraph data:');
    expect(stdout).not.toContain('DepGraph target:');
    expect(stdout).not.toContain('DepGraph end');
  });
});
