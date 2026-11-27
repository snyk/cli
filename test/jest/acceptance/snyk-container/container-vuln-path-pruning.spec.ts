import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runSnykCLI } from '../../util/runSnykCLI';
import { FakeServer, fakeServer } from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 120);

const IMAGE_TAR =
  'test/fixtures/container-projects/os-app-alpine-and-debug.tar';
const TEST_CMD = `container test docker-archive:${IMAGE_TAR} --exclude-app-vulns --json`;

type GraphPkg = { id: string; info: { name: string; version: string } };
type GraphNode = { nodeId: string; pkgId: string; deps: { nodeId: string }[] };

const pkg = (id: string): GraphPkg => {
  const [name, version] = id.split('@');
  return { id, info: { name, version } };
};

// Every package in one layer depends on every package in the next, ending in
// `deep@1.0.0`, which has width^depth paths to the root. This mimics high
// fan-in .NET graphs. `extraRootDeps` are leaf packages hung off the root.
function fanInDepGraph(width: number, depth: number, extraRootDeps: string[]) {
  const layerIds = (layer: number) =>
    Array.from({ length: width }, (_, i) => `l${layer}-p${i}@1.0.0`);
  const pkgs: GraphPkg[] = [pkg('app@1.0.0')];
  const nodes: GraphNode[] = [];

  for (let layer = 0; layer < depth; layer++) {
    layerIds(layer).forEach((id) => pkgs.push(pkg(id)));
  }
  pkgs.push(pkg('deep@1.0.0'));
  extraRootDeps.forEach((id) => pkgs.push(pkg(id)));

  nodes.push({
    nodeId: 'root-node',
    pkgId: 'app@1.0.0',
    deps: [...layerIds(0), ...extraRootDeps].map((nodeId) => ({ nodeId })),
  });
  for (let layer = 0; layer < depth; layer++) {
    const next = layer === depth - 1 ? ['deep@1.0.0'] : layerIds(layer + 1);
    for (const id of layerIds(layer)) {
      nodes.push({
        nodeId: id,
        pkgId: id,
        deps: next.map((nodeId) => ({ nodeId })),
      });
    }
  }
  for (const id of ['deep@1.0.0', ...extraRootDeps]) {
    nodes.push({ nodeId: id, pkgId: id, deps: [] });
  }

  return {
    schemaVersion: '1.2.0',
    pkgManager: { name: 'apk', repositories: [{ alias: 'alpine:3.18' }] },
    pkgs,
    graph: { rootNodeId: 'root-node', nodes },
  };
}

function testResponse(
  width: number,
  depth: number,
  vulnPkgs: string[] = ['deep@1.0.0'],
  extraRootDeps: string[] = [],
) {
  const issues = vulnPkgs.map((id) => {
    const [name, version] = id.split('@');
    return {
      pkgName: name,
      pkgVersion: version,
      issueId: `SNYK-TEST-${id}`,
      fixInfo: {
        upgradePaths: [],
        isPatchable: false,
        nearestFixedInVersion: '',
      },
    };
  });
  const issuesData = Object.fromEntries(
    issues.map((issue) => [
      issue.issueId,
      {
        id: issue.issueId,
        severity: 'high',
        title: 'Test vulnerability',
        packageName: issue.pkgName,
      },
    ]),
  );
  return {
    result: {
      issues,
      issuesData,
      depGraphData: fanInDepGraph(width, depth, extraRootDeps),
    },
    meta: { org: 'test-org', isPublic: false },
  };
}

describe('snyk container test: vulnerable path pruning', () => {
  let server: FakeServer;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: `http://localhost:${port}${baseApi}`,
      SNYK_HOST: `http://localhost:${port}`,
      SNYK_TOKEN: '123456789',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await server.closePromise();
  });

  const parse = (stdout: string) =>
    JSON.parse(stdout) as {
      uniqueCount: number;
      vulnerabilities: { id: string; from: string[] }[];
    };

  it('prunes when the paths to vulnerable packages exceed the threshold', async () => {
    // 4^8 = 65,536 paths to deep@1.0.0, above the 40,000 threshold.
    server.setCustomResponse(testResponse(4, 8));
    const { code, stdout } = await runSnykCLI(TEST_CMD, { env });

    expect(code).toEqual(1);
    const json = parse(stdout);
    expect(json.vulnerabilities).toHaveLength(16);
    expect(json.uniqueCount).toEqual(1);
  });

  it('does not prune when only the rest of the graph is large', async () => {
    // The graph has 65,536 paths to deep@1.0.0, but the vulnerable package
    // l3-p0 has only 4^3 = 64, so every one of them is kept (pruning the
    // graph would leave 16).
    server.setCustomResponse(testResponse(4, 8, ['l3-p0@1.0.0']));
    const { code, stdout } = await runSnykCLI(TEST_CMD, { env });

    expect(code).toEqual(1);
    expect(parse(stdout).vulnerabilities).toHaveLength(64);
  });

  it('keeps every path for a graph below the threshold', async () => {
    // 3^4 = 81 paths.
    server.setCustomResponse(testResponse(3, 4));
    const { code, stdout } = await runSnykCLI(TEST_CMD, { env });

    expect(code).toEqual(1);
    expect(parse(stdout).vulnerabilities).toHaveLength(81);
  });

  it('prunes below the threshold with --prune-repeated-subdependencies', async () => {
    server.setCustomResponse(testResponse(3, 4));
    const { code, stdout } = await runSnykCLI(
      `${TEST_CMD} --prune-repeated-subdependencies`,
      { env },
    );

    expect(code).toEqual(1);
    expect(parse(stdout).vulnerabilities).toHaveLength(9);
  });

  it('falls back to the full graph when pruning would drop a package', async () => {
    // Two versions of one package under the same parent collapse into one
    // when the graph is converted to a tree for pruning.
    server.setCustomResponse(
      testResponse(
        3,
        4,
        ['kernel@5.14.0-1', 'kernel@5.14.0-2'],
        ['kernel@5.14.0-1', 'kernel@5.14.0-2'],
      ),
    );
    const { code, stdout } = await runSnykCLI(
      `${TEST_CMD} --prune-repeated-subdependencies`,
      { env },
    );

    expect(code).toEqual(1);
    const json = parse(stdout);
    expect(json.uniqueCount).toEqual(2);
    expect(json.vulnerabilities).toHaveLength(2);
  });

  it('keeps every path when a path-scoped ignore applies', async () => {
    const policyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-policy-'));
    fs.writeFileSync(
      path.join(policyDir, '.snyk'),
      [
        'version: v1.25.0',
        'ignore:',
        '  SNYK-TEST-deep@1.0.0:',
        "    - 'l0-p0@1.0.0 > l1-p0@1.0.0':",
        '        reason: test',
        '',
      ].join('\n'),
    );
    server.setCustomResponse(testResponse(3, 4));
    const { code, stdout } = await runSnykCLI(
      `${TEST_CMD} --prune-repeated-subdependencies --policy-path=${policyDir}`,
      { env },
    );

    // 81 paths, of which the 3^2 = 9 under l0-p0 > l1-p0 are ignored.
    expect(code).toEqual(1);
    expect(parse(stdout).vulnerabilities).toHaveLength(72);
  });

  it('writes the unpruned graph with --print-deps --json-file-output', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-out-'));
    const outFile = path.join(outDir, 'out.json');
    server.setCustomResponse(testResponse(4, 8));
    const { code } = await runSnykCLI(
      `${TEST_CMD} --print-deps --json-file-output=${outFile}`,
      { env },
    );

    expect(code).toEqual(1);
    const written = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    // root + 32 layer packages + deep, none of them pruned placeholders.
    expect(written.depGraph.graph.nodes).toHaveLength(34);
  });
});
