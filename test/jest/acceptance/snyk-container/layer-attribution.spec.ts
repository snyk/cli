import { runSnykCLI } from '../../util/runSnykCLI';
import { describeIf, isWindowsOperatingSystem } from '../../../utils';

jest.setTimeout(1000 * 300);

/**
 * `--layer-attribution` (snyk-docker-plugin v9.11.0+) stamps a
 * `dockerLayerDiffId` label on each OS dep-graph node, identifying the rootfs
 * layer (by diffID) that introduced the package. It's a pure pass-through flag
 * with no CLI-side logic, so scanning a real archive is the only coverage.
 *
 * Fixture `slim-layer-attr.tar` is an Alpine 3.19.9 (apk) image where bash,
 * tmux and jq are each installed in their own `apk add` layer on top of the
 * base layer, so the packages below span four distinct layers.
 */
const IMAGE =
  'docker-archive:test/fixtures/container-projects/slim-layer-attr.tar';

const DIFF_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;

// Ground truth from scanning the fixture with snyk-docker-plugin v9.11.0.
// Regenerate these diffIDs if the fixture image is ever rebuilt.
const EXPECTED_LAYER_BY_PKG: Record<string, string> = {
  'alpine-baselayout/alpine-baselayout-data@3.4.3-r2':
    'sha256:8ff721756ec0097ba331876f1502858f8849716bdf720516fafa96c72a8d7dac',
  'bash/bash@5.2.21-r0':
    'sha256:b5ef241821a04d8186bfc6d8f413ee041d37bb2ab8fafb9756a0513483c79136',
  'tmux/tmux@3.3a_git20230428-r0':
    'sha256:7139030ad049d9be8252e290c06caeda7218c33fff72682fb8c048620c2e3013',
  'jq/jq@1.7.1-r0':
    'sha256:7a7212b299904bec18f2ffd90b06132c863a6b4046b981bcdd67d9e1c1115228',
};

interface DepGraphNode {
  nodeId: string;
  pkgId: string;
  info?: { labels?: Record<string, string> };
}

// `monitor --json` embeds the local scanResult.facts, giving us both the
// depGraph (with the stamped labels) and the rootFs fact to cross-check.
async function monitorScanResult(extraFlags = ''): Promise<any> {
  const { code, stdout, stderr } = await runSnykCLI(
    `container monitor ${IMAGE} ${extraFlags} --json`,
  );

  expect(code).toBe(0);

  let parsed: any;
  try {
    parsed = JSON.parse(stdout);
  } catch (e) {
    throw new Error(
      `Failed to parse monitor --json output: ${e}. Stderr: ${stderr}`,
    );
  }

  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  expect(result.scanResult).toBeDefined();
  return result.scanResult;
}

function factData(scanResult: any, type: string): any {
  const fact = scanResult.facts?.find((f: any) => f.type === type);
  expect(fact).toBeDefined();
  return fact.data;
}

// Real package nodes only: the synthetic root and `docker-image|…` nodes are
// not attributable.
function packageNodes(depGraph: any): DepGraphNode[] {
  const rootNodeId = depGraph.graph.rootNodeId;
  return depGraph.graph.nodes.filter(
    (n: DepGraphNode) =>
      n.nodeId !== rootNodeId && !n.pkgId.startsWith('docker-image|'),
  );
}

describe('snyk container - --layer-attribution', () => {
  describeIf(!isWindowsOperatingSystem())('apk (alpine) image', () => {
    it('attributes each OS package to its introducing rootfs layer', async () => {
      const scanResult = await monitorScanResult('--layer-attribution');
      const depGraph = factData(scanResult, 'depGraph');

      expect(depGraph.pkgManager.name).toBe('apk');

      // rootFs is the image's authoritative layer list, produced independently
      // of the dep-graph labels, so it's a valid ground truth to validate against.
      const rootFsSet = new Set<string>(factData(scanResult, 'rootFs'));

      const labelByPkgId = new Map<string, string>();
      const nodes = packageNodes(depGraph);
      expect(nodes.length).toBeGreaterThan(0);

      // Every OS package node is attributed to a real layer of this image.
      for (const node of nodes) {
        const diffId = node.info?.labels?.dockerLayerDiffId;
        expect(diffId).toMatch(DIFF_ID_PATTERN);
        expect(rootFsSet.has(diffId as string)).toBe(true);
        labelByPkgId.set(node.pkgId, diffId as string);
      }

      // The pinned packages get the exact expected (and distinct) layers,
      // proving correct per-layer attribution rather than a shared value.
      for (const [pkgId, expectedDiffId] of Object.entries(
        EXPECTED_LAYER_BY_PKG,
      )) {
        expect(labelByPkgId.get(pkgId)).toBe(expectedDiffId);
      }
    });

    it('stamps no dockerLayerDiffId labels without the flag', async () => {
      const scanResult = await monitorScanResult();
      const depGraph = factData(scanResult, 'depGraph');

      const labelled = packageNodes(depGraph).filter(
        (n) => n.info?.labels?.dockerLayerDiffId,
      );
      expect(labelled).toHaveLength(0);
    });
  });
});
