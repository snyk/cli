import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

// `--include-component-metadata` makes the node plugin forward the flag to
// snyk-nodejs-lockfile-parser, which reads the install-time `integrity` /
// `resolved` fields recorded in the lockfile and surfaces them as
// `hash:<algorithm>` and `distribution:url` labels on the dep-graph nodes.
//
// yarn v1 lockfiles carry npm-shaped `integrity` (SRI) + `resolved` (tarball
// URL, with a `#<sha1>` shasum fragment), so v1 is fully supported. yarn berry
// (v2-4) lockfiles carry no tarball URL and only a `checksum` over yarn's cache
// artifact (not the published tarball SRI), so berry is deferred (CMPA-611):
// the flag is accepted but no labels are produced.
describe('`snyk test --include-component-metadata` (yarn)', () => {
  interface PrintedGraph {
    target: string;
    graph: any;
  }

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

  describe('yarn lockfile v1', () => {
    const fixture = 'yarn-include-component-metadata/lock-v1';

    it('attaches hash and distribution:url labels with the flag', async () => {
      const project = await createProjectFromFixture(fixture);

      const { code, stdout } = await runSnykCLI(
        'test --include-component-metadata --print-graph --file=yarn.lock',
        { cwd: project.path() },
      );

      expect(code).toEqual(0);
      const graphs = parseDepGraphs(stdout);
      expect(graphs).toHaveLength(1);
      expect(labelKeys(graphs[0].graph, 'hash:').length).toBeGreaterThan(0);
      expect(
        labelKeys(graphs[0].graph, 'distribution:url').length,
      ).toBeGreaterThan(0);
      // The shasum fragment is stripped from the emitted URL.
      const urls: string[] = graphs[0].graph.graph.nodes
        .map((node) => node.info?.labels?.['distribution:url'])
        .filter(Boolean);
      expect(urls.length).toBeGreaterThan(0);
      urls.forEach((url) => expect(url).not.toContain('#'));
    });

    it('does not attach the labels without the flag', async () => {
      const project = await createProjectFromFixture(fixture);

      const { code, stdout } = await runSnykCLI(
        'test --print-graph --file=yarn.lock',
        { cwd: project.path() },
      );

      expect(code).toEqual(0);
      const graphs = parseDepGraphs(stdout);
      expect(graphs).toHaveLength(1);
      expect(labelKeys(graphs[0].graph, 'hash:')).toHaveLength(0);
      expect(labelKeys(graphs[0].graph, 'distribution:url')).toHaveLength(0);
    });
  });

  // Berry is deferred: the flag is accepted (no error) but produces no labels.
  describe('yarn berry (v2-4)', () => {
    const fixture = 'yarn-include-component-metadata/lock-v2';

    it('accepts the flag but produces no component-metadata labels (deferred)', async () => {
      const project = await createProjectFromFixture(fixture);

      const { code, stdout } = await runSnykCLI(
        'test --include-component-metadata --print-graph --file=yarn.lock',
        { cwd: project.path() },
      );

      expect(code).toEqual(0);
      const graphs = parseDepGraphs(stdout);
      expect(graphs).toHaveLength(1);
      expect(labelKeys(graphs[0].graph, 'hash:')).toHaveLength(0);
      expect(labelKeys(graphs[0].graph, 'distribution:url')).toHaveLength(0);
    });
  });
});
