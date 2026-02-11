import { DepGraphData } from '@snyk/dep-graph';
import { inspect } from '../../../../src/lib/plugins/uv';
import { UV_MONITOR_ENABLED_ENV_VAR } from '../../../../src/lib/package-managers';
import * as goBridge from '../../../../src/lib/go-bridge';
import { GoCommandResult } from '../../../../src/lib/go-bridge';

const MOCK_DEP_GRAPH_DATA: DepGraphData = {
  schemaVersion: '1.3.0',
  pkgManager: {
    name: 'pip',
  },
  pkgs: [
    {
      id: 'my-project@1.0.0',
      info: { name: 'my-project', version: '1.0.0' },
    },
    {
      id: 'requests@2.31.0',
      info: { name: 'requests', version: '2.31.0' },
    },
  ],
  graph: {
    rootNodeId: 'root-node',
    nodes: [
      {
        nodeId: 'root-node',
        pkgId: 'my-project@1.0.0',
        deps: [{ nodeId: 'requests@2.31.0' }],
      },
      {
        nodeId: 'requests@2.31.0',
        pkgId: 'requests@2.31.0',
        deps: [],
      },
    ],
  },
};

function mockResult(
  stdout: string,
  exitCode = 0,
  stderr = '',
): GoCommandResult {
  return { exitCode, stdout, stderr };
}

describe('uv plugin', () => {
  const originalEnv = process.env;
  let execGoCommandSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv };
    execGoCommandSpy = jest
      .spyOn(goBridge, 'execGoCommand')
      .mockResolvedValue(
        mockResult(JSON.stringify(MOCK_DEP_GRAPH_DATA)),
      );
  });

  afterEach(() => {
    execGoCommandSpy.mockRestore();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('when env var is not set', () => {
    it('throws an error', async () => {
      delete process.env[UV_MONITOR_ENABLED_ENV_VAR];

      await expect(inspect('.', 'uv.lock')).rejects.toThrow(
        'uv monitor support is not yet available.',
      );

      expect(execGoCommandSpy).not.toHaveBeenCalled();
    });
  });

  describe('when env var is set to true', () => {
    beforeEach(() => {
      process.env[UV_MONITOR_ENABLED_ENV_VAR] = 'true';
    });

    it('calls execGoCommand with depgraph args', async () => {
      await inspect('.', 'uv.lock');

      expect(execGoCommandSpy).toHaveBeenCalledTimes(1);
      expect(execGoCommandSpy).toHaveBeenCalledWith([
        'depgraph',
        '--file=uv.lock',
        '--use-sbom-resolution',
        '--json',
      ]);
    });

    it('returns a valid result with the parsed depGraph', async () => {
      const result = await inspect('.', 'uv.lock');

      expect(result.plugin).toEqual({
        name: 'snyk-uv-plugin',
        runtime: process.version,
        targetFile: 'uv.lock',
        packageManager: 'pip',
      });
      expect(result.scannedProjects).toHaveLength(1);

      const depGraph = result.scannedProjects[0].depGraph;
      if (!depGraph) {
        throw new Error('expected depGraph to be defined');
      }
      expect(depGraph.rootPkg).toEqual({
        name: 'my-project',
        version: '1.0.0',
      });
      expect(depGraph.pkgManager.name).toBe('pip');

      const depNames = depGraph
        .getDepPkgs()
        .map((p) => p.name)
        .sort();
      expect(depNames).toEqual(['requests']);
    });

    it('passes through the target file', async () => {
      const result = await inspect('.', 'path/to/uv.lock');

      expect(execGoCommandSpy).toHaveBeenCalledWith([
        'depgraph',
        '--file=path/to/uv.lock',
        '--use-sbom-resolution',
        '--json',
      ]);
      expect(result.plugin.targetFile).toBe('path/to/uv.lock');
      expect(result.scannedProjects[0].targetFile).toBe('path/to/uv.lock');
    });

    it('handles multiple dep-graphs from the binary', async () => {
      const secondGraph: DepGraphData = {
        schemaVersion: '1.3.0',
        pkgManager: { name: 'pip' },
        pkgs: [
          {
            id: 'other-project@2.0.0',
            info: { name: 'other-project', version: '2.0.0' },
          },
        ],
        graph: {
          rootNodeId: 'root-node',
          nodes: [
            {
              nodeId: 'root-node',
              pkgId: 'other-project@2.0.0',
              deps: [],
            },
          ],
        },
      };

      execGoCommandSpy.mockResolvedValue(
        mockResult(JSON.stringify([MOCK_DEP_GRAPH_DATA, secondGraph])),
      );

      const result = await inspect('.', 'uv.lock');

      expect(result.scannedProjects).toHaveLength(2);

      const first = result.scannedProjects[0].depGraph;
      const second = result.scannedProjects[1].depGraph;
      if (!first || !second) {
        throw new Error('expected both depGraphs to be defined');
      }
      expect(first.rootPkg.name).toBe('my-project');
      expect(second.rootPkg.name).toBe('other-project');
    });

    it('throws with the error field from structured JSON on failure', async () => {
      const jsonError = JSON.stringify({
        ok: false,
        error: 'uv version 0.9.9 is not supported. Minimum required version is 0.9.23',
        path: '/some/project',
      });
      execGoCommandSpy.mockResolvedValue(mockResult(jsonError, 2));

      await expect(inspect('.', 'uv.lock')).rejects.toMatchObject({
        detail: expect.stringContaining('uv version 0.9.9 is not supported'),
      });
    });

    it('falls back to stderr when stdout is not JSON on failure', async () => {
      execGoCommandSpy.mockResolvedValue(
        mockResult('', 1, 'depgraph command failed'),
      );

      await expect(inspect('.', 'uv.lock')).rejects.toMatchObject({
        detail: 'depgraph command failed',
      });
    });

    it('throws when the binary fails to spawn', async () => {
      execGoCommandSpy.mockRejectedValue(new Error('spawn ENOENT'));

      await expect(inspect('.', 'uv.lock')).rejects.toThrow('spawn ENOENT');
    });

    it('throws when the binary returns invalid JSON', async () => {
      execGoCommandSpy.mockResolvedValue(mockResult('not valid json'));

      await expect(inspect('.', 'uv.lock')).rejects.toThrow();
    });
  });
});
