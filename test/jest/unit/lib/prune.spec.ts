import { createFromJSON, DepGraphData } from '@snyk/dep-graph';
import { pruneVulnerablePathsGraph } from '../../../../src/lib/prune';

// root -> a, b; a -> c, b -> c; c -> d. d has 2 paths to the root.
function diamondGraph(extraRootDeps: string[] = []): DepGraphData {
  const ids = ['a@1.0.0', 'b@1.0.0', 'c@1.0.0', 'd@1.0.0', ...extraRootDeps];
  return {
    schemaVersion: '1.2.0',
    pkgManager: { name: 'npm' },
    pkgs: [
      { id: 'root@1.0.0', info: { name: 'root', version: '1.0.0' } },
      ...ids.map((id) => {
        const [name, version] = id.split('@');
        return { id, info: { name, version } };
      }),
    ],
    graph: {
      rootNodeId: 'root-node',
      nodes: [
        {
          nodeId: 'root-node',
          pkgId: 'root@1.0.0',
          deps: [{ nodeId: 'a@1.0.0' }, { nodeId: 'b@1.0.0' }].concat(
            extraRootDeps.map((nodeId) => ({ nodeId })),
          ),
        },
        { nodeId: 'a@1.0.0', pkgId: 'a@1.0.0', deps: [{ nodeId: 'c@1.0.0' }] },
        { nodeId: 'b@1.0.0', pkgId: 'b@1.0.0', deps: [{ nodeId: 'c@1.0.0' }] },
        { nodeId: 'c@1.0.0', pkgId: 'c@1.0.0', deps: [{ nodeId: 'd@1.0.0' }] },
        { nodeId: 'd@1.0.0', pkgId: 'd@1.0.0', deps: [] },
        ...extraRootDeps.map((id) => ({ nodeId: id, pkgId: id, deps: [] })),
      ],
    },
  };
}

const d = { name: 'd', version: '1.0.0' };

describe('pruneVulnerablePathsGraph', () => {
  it('returns the same graph when the vulnerable paths are below the threshold', async () => {
    const graph = createFromJSON(diamondGraph());
    const result = await pruneVulnerablePathsGraph(graph, 'npm', [d]);
    expect(result).toBe(graph);
  });

  it('prunes when pruning is required and keeps every package', async () => {
    const graph = createFromJSON(diamondGraph());
    const result = await pruneVulnerablePathsGraph(graph, 'npm', [d], true);
    expect(result).not.toBe(graph);
    expect(
      result
        .getPkgs()
        .map((p) => `${p.name}@${p.version}`)
        .sort(),
    ).toEqual(
      graph
        .getPkgs()
        .map((p) => `${p.name}@${p.version}`)
        .sort(),
    );
    expect(result.countPathsToRoot(d)).toBeLessThanOrEqual(
      graph.countPathsToRoot(d),
    );
  });

  it('returns the original graph when pruning would drop a package', async () => {
    // Two versions of `e` under the root collapse into one in a dep tree.
    const graph = createFromJSON(diamondGraph(['e@1.0.0', 'e@2.0.0']));
    const result = await pruneVulnerablePathsGraph(
      graph,
      'npm',
      [{ name: 'e', version: '1.0.0' }],
      true,
    );
    expect(result).toBe(graph);
  });

  it('ignores vulnerable packages that are not in the graph', async () => {
    const graph = createFromJSON(diamondGraph());
    const result = await pruneVulnerablePathsGraph(graph, 'npm', [
      { name: 'missing', version: '1.0.0' },
    ]);
    expect(result).toBe(graph);
  });
});
