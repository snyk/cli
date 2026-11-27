import { createFromJSON, DepGraphData } from '@snyk/dep-graph';
import config from '../../../../src/lib/config';
import {
  pruneVulnerablePathsGraph,
  vulnerablePathsExceedThreshold,
} from '../../../../src/lib/prune';

type Edges = Record<string, string[]>;

// Builds a graph from `root` edges. Node ids are the pkg ids.
function graphFrom(edges: Edges, rootVersion = '1.0.0'): DepGraphData {
  const ids = new Set<string>();
  Object.values(edges).forEach((deps) => deps.forEach((id) => ids.add(id)));
  Object.keys(edges)
    .filter((id) => id !== 'root')
    .forEach((id) => ids.add(id));
  const pkgInfo = (id: string) => {
    const [name, version] = id.split('@');
    return { id, info: { name, version } };
  };
  return {
    schemaVersion: '1.2.0',
    pkgManager: { name: 'npm' },
    pkgs: [
      {
        id: `root@${rootVersion}`,
        info: { name: 'root', version: rootVersion },
      },
      ...[...ids].map(pkgInfo),
    ],
    graph: {
      rootNodeId: 'root-node',
      nodes: [
        {
          nodeId: 'root-node',
          pkgId: `root@${rootVersion}`,
          deps: (edges.root || []).map((nodeId) => ({ nodeId })),
        },
        ...[...ids].map((id) => ({
          nodeId: id,
          pkgId: id,
          deps: (edges[id] || []).map((nodeId) => ({ nodeId })),
        })),
      ],
    },
  };
}

// width^depth paths from the root to deep@1.0.0.
function fanIn(width: number, depth: number): DepGraphData {
  const layer = (l: number) =>
    Array.from({ length: width }, (_, i) => `l${l}-p${i}@1.0.0`);
  const edges: Edges = { root: layer(0) };
  for (let l = 0; l < depth; l++) {
    const next = l === depth - 1 ? ['deep@1.0.0'] : layer(l + 1);
    layer(l).forEach((id) => (edges[id] = next));
  }
  return graphFrom(edges);
}

const deep = { name: 'deep', version: '1.0.0' };
const d = { name: 'd', version: '1.0.0' };

// Within top-level dep `a`, `c` is reached twice (a > c and a > b > c), so
// pruning keeps one of them expanded.
const repeatedWithinTopLevel: Edges = {
  root: ['a@1.0.0'],
  'a@1.0.0': ['b@1.0.0', 'c@1.0.0'],
  'b@1.0.0': ['c@1.0.0'],
  'c@1.0.0': ['d@1.0.0'],
};

describe('vulnerablePathsExceedThreshold', () => {
  const originalThreshold = config.PRUNE_DEPS_THRESHOLD;
  beforeAll(() => {
    // The value from config.default.json; unit tests don't load it.
    config.PRUNE_DEPS_THRESHOLD = 40000;
  });
  afterAll(() => {
    config.PRUNE_DEPS_THRESHOLD = originalThreshold;
  });

  it('counts paths to the vulnerable packages only', () => {
    // 4^8 = 65,536 paths to deep, above the 40,000 threshold.
    const graph = createFromJSON(fanIn(4, 8));
    expect(
      vulnerablePathsExceedThreshold(graph, [{ pkg: deep, issueCount: 1 }]),
    ).toBe(true);
    expect(
      vulnerablePathsExceedThreshold(graph, [
        { pkg: { name: 'l2-p0', version: '1.0.0' }, issueCount: 1 },
      ]),
    ).toBe(false);
  });

  it('counts one entry per path per issue', () => {
    // 3^9 = 19,683 paths: below the threshold for 1 issue, above it for 3.
    const graph = createFromJSON(fanIn(3, 9));
    expect(
      vulnerablePathsExceedThreshold(graph, [{ pkg: deep, issueCount: 1 }]),
    ).toBe(false);
    expect(
      vulnerablePathsExceedThreshold(graph, [{ pkg: deep, issueCount: 3 }]),
    ).toBe(true);
  });

  it('ignores vulnerable packages that are not in the graph', () => {
    const graph = createFromJSON(fanIn(4, 8));
    expect(
      vulnerablePathsExceedThreshold(graph, [
        { pkg: { name: 'missing', version: '1.0.0' }, issueCount: 5 },
      ]),
    ).toBe(false);
  });
});

describe('pruneVulnerablePathsGraph', () => {
  it('reduces repeated paths and keeps every package', async () => {
    const graph = createFromJSON(graphFrom(repeatedWithinTopLevel));
    const pruned = await pruneVulnerablePathsGraph(graph, 'npm');

    expect(pruned.countPathsToRoot(d)).toBeLessThan(graph.countPathsToRoot(d));
    const keys = (g: typeof graph) =>
      g
        .getDepPkgs()
        .map((p) => `${p.name}@${p.version}`)
        .sort();
    expect(keys(pruned)).toEqual(keys(graph));
  });

  it('prunes a graph whose root has an empty version', async () => {
    const graph = createFromJSON(graphFrom(repeatedWithinTopLevel, ''));
    const pruned = await pruneVulnerablePathsGraph(graph, 'npm');
    expect(pruned.countPathsToRoot(d)).toBeLessThan(graph.countPathsToRoot(d));
  });

  it('returns the original graph when a node has same-name children', async () => {
    // a's two x versions collapse into one in a dep tree. x@1.0.0 survives
    // under b, so a package-set comparison alone would miss the lost path.
    const graph = createFromJSON(
      graphFrom({
        root: ['a@1.0.0', 'b@1.0.0'],
        'a@1.0.0': ['x@1.0.0', 'x@2.0.0'],
        'b@1.0.0': ['x@1.0.0'],
      }),
    );
    expect(await pruneVulnerablePathsGraph(graph, 'npm')).toBe(graph);
  });

  it('returns the original graph when pruning throws', async () => {
    const graph = createFromJSON(graphFrom(repeatedWithinTopLevel));
    const broken = Object.create(graph);
    broken.toJSON = () => {
      throw new Error('boom');
    };
    expect(await pruneVulnerablePathsGraph(broken, 'npm')).toBe(broken);
  });
});
