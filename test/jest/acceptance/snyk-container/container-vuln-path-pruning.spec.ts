import { runSnykCLI } from '../../util/runSnykCLI';
import { FakeServer, fakeServer } from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 120);

const IMAGE_TAR =
  'test/fixtures/container-projects/os-app-alpine-and-debug.tar';
const ISSUE_ID = 'SNYK-TEST-DEEP-1';

// A layered graph where every package in one layer depends on every package
// in the next, ending in one vulnerable leaf. The leaf has width^depth paths
// to the root, which mimics high fan-in .NET graphs (System.* packages).
function fanInDepGraph(width: number, depth: number) {
  const pkgs = [{ id: 'app@1.0.0', info: { name: 'app', version: '1.0.0' } }];
  const nodes: { nodeId: string; pkgId: string; deps: { nodeId: string }[] }[] =
    [];
  const layerIds = (layer: number) =>
    Array.from({ length: width }, (_, i) => `l${layer}-p${i}@1.0.0`);

  for (let layer = 0; layer < depth; layer++) {
    for (const id of layerIds(layer)) {
      const [name, version] = id.split('@');
      pkgs.push({ id, info: { name, version } });
    }
  }
  pkgs.push({ id: 'deep@1.0.0', info: { name: 'deep', version: '1.0.0' } });

  nodes.push({
    nodeId: 'root-node',
    pkgId: 'app@1.0.0',
    deps: layerIds(0).map((nodeId) => ({ nodeId })),
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
  nodes.push({ nodeId: 'deep@1.0.0', pkgId: 'deep@1.0.0', deps: [] });

  return {
    schemaVersion: '1.2.0',
    pkgManager: { name: 'apk', repositories: [{ alias: 'alpine:3.18' }] },
    pkgs,
    graph: { rootNodeId: 'root-node', nodes },
  };
}

function testResponse(width: number, depth: number) {
  return {
    result: {
      issues: [
        {
          pkgName: 'deep',
          pkgVersion: '1.0.0',
          issueId: ISSUE_ID,
          fixInfo: {
            upgradePaths: [],
            isPatchable: false,
            nearestFixedInVersion: '',
          },
        },
      ],
      issuesData: {
        [ISSUE_ID]: {
          id: ISSUE_ID,
          severity: 'high',
          title: 'Test vulnerability',
          packageName: 'deep',
        },
      },
      depGraphData: fanInDepGraph(width, depth),
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

  const vulnEntries = (stdout: string) => {
    const json = JSON.parse(stdout);
    return json.vulnerabilities as { id: string; from: string[] }[];
  };

  it('prunes a graph above the path threshold instead of writing one entry per path', async () => {
    // 4^8 = 65,536 paths to the vulnerable leaf, above the 40,000 threshold.
    server.setCustomResponse(testResponse(4, 8));
    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:${IMAGE_TAR} --exclude-app-vulns --json`,
      { env },
    );

    expect(code).toEqual(1);
    const entries = vulnEntries(stdout);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThan(1000);
    expect(entries.every((v) => v.id === ISSUE_ID)).toBe(true);
    expect(JSON.parse(stdout).uniqueCount).toEqual(1);
  });

  it('keeps every path for a graph below the threshold', async () => {
    // 3^4 = 81 paths.
    server.setCustomResponse(testResponse(3, 4));
    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:${IMAGE_TAR} --exclude-app-vulns --json`,
      { env },
    );

    expect(code).toEqual(1);
    expect(vulnEntries(stdout)).toHaveLength(81);
  });

  it('prunes below the threshold with --prune-repeated-subdependencies', async () => {
    server.setCustomResponse(testResponse(3, 4));
    const { code, stdout } = await runSnykCLI(
      `container test docker-archive:${IMAGE_TAR} --exclude-app-vulns --json --prune-repeated-subdependencies`,
      { env },
    );

    expect(code).toEqual(1);
    const entries = vulnEntries(stdout);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThan(81);
  });
});
