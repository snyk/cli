import { createFromJSON, DepGraphData } from '@snyk/dep-graph';
import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import * as types from '../types';

export const UV_MONITOR_ENABLED_ENV_VAR = 'SNYK_INTERNAL_UV_MONITOR_ENABLED';

const STUB_DEP_GRAPH_DATA: DepGraphData = {
  schemaVersion: '1.3.0',
  pkgManager: {
    name: 'pip',
  },
  pkgs: [
    {
      id: 'uv-project@0.1.0',
      info: { name: 'uv-project', version: '0.1.0' },
    },
    {
      id: 'urllib3@1.26.15',
      info: { name: 'urllib3', version: '1.26.15' },
    },
    {
      id: 'cryptography@40.0.0',
      info: { name: 'cryptography', version: '40.0.0' },
    },
    {
      id: 'cffi@2.0.0',
      info: { name: 'cffi', version: '2.0.0' },
    },
  ],
  graph: {
    rootNodeId: 'root-node',
    nodes: [
      {
        nodeId: 'root-node',
        pkgId: 'uv-project@0.1.0',
        deps: [
          { nodeId: 'urllib3@1.26.15' },
          { nodeId: 'cryptography@40.0.0' },
        ],
      },
      {
        nodeId: 'urllib3@1.26.15',
        pkgId: 'urllib3@1.26.15',
        deps: [],
      },
      {
        nodeId: 'cryptography@40.0.0',
        pkgId: 'cryptography@40.0.0',
        deps: [{ nodeId: 'cffi@2.0.0' }],
      },
      {
        nodeId: 'cffi@2.0.0',
        pkgId: 'cffi@2.0.0',
        deps: [],
      },
    ],
  },
};

export async function inspect(
  _root: string,
  targetFile: string,
  _options: types.Options = {}, // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<MultiProjectResult> {
  if (process.env[UV_MONITOR_ENABLED_ENV_VAR] !== 'true') {
    throw new Error(`uv monitor support is not yet available.`);
  }

  const depGraph = createFromJSON(STUB_DEP_GRAPH_DATA);

  return {
    plugin: {
      name: 'snyk-uv-plugin',
      runtime: process.version,
      targetFile,
      packageManager: 'pip',
    },
    scannedProjects: [
      {
        depGraph,
        targetFile,
      },
    ],
  };
}
