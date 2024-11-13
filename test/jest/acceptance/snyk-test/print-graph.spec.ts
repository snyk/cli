import {
  createProjectFromFixture,
  createProjectFromWorkspace,
} from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('print graph', () => {
  test("`snyk test --print-graph` should print a project's dep-graph", async () => {
    const project = await createProjectFromWorkspace('npm-package');

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
    });

    expect(code).toEqual(0);
    expect(stdout).toMatch('DepGraph data:');
    expect(stdout).toMatch('DepGraph target:\npackage-lock.json');
  });

  test('`snyk test --print-graph` should not prune maven dependencies', async () => {
    const project = await createProjectFromWorkspace('maven-many-paths');

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
    });

    expect(code).toEqual(0);
    const depGraph = JSON.parse(
      stdout.split('DepGraph data:')[1]?.split('DepGraph target:')[0],
    );
    let numEdges = 0;
    for (const node of depGraph.graph.nodes) {
      numEdges += node.deps.length;
    }
    expect(numEdges).toEqual(7);
  });

  test('`snyk test --print-graph` should not prune gradle dependencies', async () => {
    const project = await createProjectFromFixture('gradle-with-repeated-deps');

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
    });

    expect(code).toEqual(0);
    const depGraph = JSON.parse(
      stdout.split('DepGraph data:')[1]?.split('DepGraph target:')[0],
    );
    let numEdges = 0;
    for (const node of depGraph.graph.nodes) {
      numEdges += node.deps.length;
    }
    expect(numEdges).toEqual(28);
  });

  test('`snyk test --print-graph --all-projects` should not prune dependencies', async () => {
    const project = await createProjectFromWorkspace('maven-many-paths');

    const { code, stdout } = await runSnykCLI(
      'test --print-graph --all-projects',
      {
        cwd: project.path(),
      },
    );

    expect(code).toEqual(0);
    const depGraphs = stdout
      .split('DepGraph data:')
      .filter(Boolean)
      .map((s) => JSON.parse(s.split('DepGraph target:')[0]));

    let numEdges = 0;
    for (const depGraph of depGraphs) {
      for (const node of depGraph.graph.nodes) {
        numEdges += node.deps.length;
      }
    }
    expect(numEdges).toEqual(14);
  });
});
