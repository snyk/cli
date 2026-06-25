import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

// `--include-component-metadata` makes the npm plugin forward the flag to
// snyk-nodejs-lockfile-parser, which reads the install-time `integrity` and
// `resolved` fields already recorded in the lockfile and surfaces them as
// `hash:<algorithm>` and `distribution:url` labels on the dep-graph nodes.
// Unlike maven there is nothing to resolve first — the metadata lives in the
// lockfile — so these fixtures need no `npm install`.
//
// Covers npm lockfile v1 (legacy depTree path, converted to a dep-graph for
// printing) and v2/v3 (native dep-graph path).
describe('`snyk test --include-component-metadata` (npm)', () => {
  interface PrintedGraph {
    target: string;
    graph: any;
  }

  // `--print-graph` emits one `DepGraph data:\n<json>\nDepGraph target:\n<target>
  // \nDepGraph end` block per scanned project. Split on the block delimiter so
  // each graph can be asserted against by its target file rather than lumping
  // every node together (which would hide which project a label came from).
  const parseDepGraphs = (printGraphStdout: string): PrintedGraph[] =>
    printGraphStdout
      .split('DepGraph end')
      .filter((block) => block.includes('DepGraph data:'))
      .map((block) => ({
        graph: JSON.parse(
          block.split('DepGraph data:')[1].split('DepGraph target:')[0],
        ),
        target: block.split('DepGraph target:')[1].trim(),
      }));

  const labelKeys = (graph: any, prefix: string): string[] =>
    graph.graph.nodes
      .flatMap((node) => Object.keys(node.info?.labels ?? {}))
      .filter((key) => key.startsWith(prefix));

  const fixtures = [
    ['v1', 'npm-include-component-metadata/lock-v1'],
    ['v2', 'npm-include-component-metadata/lock-v2'],
    ['v3', 'npm-include-component-metadata/lock-v3'],
  ];

  describe.each(fixtures)('lockfile %s', (_version, fixture) => {
    it('attaches hash and distribution:url labels with the flag', async () => {
      const project = await createProjectFromFixture(fixture);

      const { code, stdout } = await runSnykCLI(
        'test --include-component-metadata --print-graph --file=package-lock.json',
        { cwd: project.path() },
      );

      expect(code).toEqual(0);
      const graphs = parseDepGraphs(stdout);
      expect(graphs).toHaveLength(1);
      expect(labelKeys(graphs[0].graph, 'hash:').length).toBeGreaterThan(0);
      expect(
        labelKeys(graphs[0].graph, 'distribution:url').length,
      ).toBeGreaterThan(0);
    });

    // Control: without the flag the same project must not produce the labels,
    // proving they are driven by `--include-component-metadata`.
    it('does not attach the labels without the flag', async () => {
      const project = await createProjectFromFixture(fixture);

      const { code, stdout } = await runSnykCLI(
        'test --print-graph --file=package-lock.json',
        { cwd: project.path() },
      );

      expect(code).toEqual(0);
      const graphs = parseDepGraphs(stdout);
      expect(graphs).toHaveLength(1);
      expect(labelKeys(graphs[0].graph, 'hash:')).toHaveLength(0);
      expect(labelKeys(graphs[0].graph, 'distribution:url')).toHaveLength(0);
    });
  });

  // Workspace scans go through getMultiPluginResult -> processNpmWorkspaces,
  // bypassing the single-file plugin path, so the flag must be forwarded there
  // too. Without that wiring `--all-projects` silently produced no metadata
  // labels for workspace projects.
  //
  // The fixture declares `workspaces` in the array form (`["packages/a", ...]`):
  // processNpmWorkspaces' getWorkspacesMap only recognises that shape, so each
  // member's package.json resolves against the root lockfile and no per-package
  // lockfile or `npm install` is needed. `--all-projects` prints three graphs:
  // the project-level root (package.json) which has no external direct deps and
  // therefore no metadata labels, plus the two members whose deps (ms /
  // is-number) carry them.
  describe('npm workspaces (`--all-projects`)', () => {
    const fixture = 'npm-include-component-metadata/workspace';
    const root = 'package.json';
    const members = ['packages/a/package.json', 'packages/b/package.json'];

    it('attaches hash and distribution:url labels to the workspace members', async () => {
      const project = await createProjectFromFixture(fixture);

      const { code, stdout } = await runSnykCLI(
        'test --include-component-metadata --print-graph --all-projects',
        { cwd: project.path() },
      );

      expect(code).toEqual(0);
      const graphs = parseDepGraphs(stdout);
      expect(graphs.map((g) => g.target).sort()).toEqual([root, ...members]);

      const byTarget = (target: string) => {
        const found = graphs.find((g) => g.target === target);
        if (!found) {
          throw new Error(`no printed dep-graph for target ${target}`);
        }
        return found.graph;
      };

      // The root project itself has no external direct dependencies, so it
      // carries no component-metadata labels — only the members do.
      expect(labelKeys(byTarget(root), 'hash:')).toHaveLength(0);

      for (const member of members) {
        expect(labelKeys(byTarget(member), 'hash:').length).toBeGreaterThan(0);
        expect(
          labelKeys(byTarget(member), 'distribution:url').length,
        ).toBeGreaterThan(0);
      }
    });

    it('does not attach the labels without the flag', async () => {
      const project = await createProjectFromFixture(fixture);

      const { code, stdout } = await runSnykCLI(
        'test --print-graph --all-projects',
        { cwd: project.path() },
      );

      expect(code).toEqual(0);
      const graphs = parseDepGraphs(stdout);
      expect(graphs.map((g) => g.target).sort()).toEqual([root, ...members]);

      for (const { graph } of graphs) {
        expect(labelKeys(graph, 'hash:')).toHaveLength(0);
        expect(labelKeys(graph, 'distribution:url')).toHaveLength(0);
      }
    });
  });
});
