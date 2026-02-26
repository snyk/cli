import { DepGraphData } from '@snyk/dep-graph';
import { CLI, ProblemError } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from '../../errors';
import { inspect, UV_MONITOR_ENABLED_ENV_VAR } from './index';
import * as goBridge from '../../go-bridge';

const MOCK_DEP_GRAPH_DATA: DepGraphData = {
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
      id: 'cffi@2.0.0',
      info: { name: 'cffi', version: '2.0.0' },
    },
    {
      id: 'cryptography@40.0.0',
      info: { name: 'cryptography', version: '40.0.0' },
    },
    {
      id: 'urllib3@1.26.15',
      info: { name: 'urllib3', version: '1.26.15' },
    },
  ],
  graph: {
    rootNodeId: 'uv-project@0.1.0',
    nodes: [
      {
        nodeId: 'uv-project@0.1.0',
        pkgId: 'uv-project@0.1.0',
        deps: [
          { nodeId: 'cffi@2.0.0' },
          { nodeId: 'cryptography@40.0.0' },
          { nodeId: 'urllib3@1.26.15' },
        ],
      },
      {
        nodeId: 'cffi@2.0.0',
        pkgId: 'cffi@2.0.0',
        deps: [],
      },
      {
        nodeId: 'cryptography@40.0.0',
        pkgId: 'cryptography@40.0.0',
        deps: [],
      },
      {
        nodeId: 'urllib3@1.26.15',
        pkgId: 'urllib3@1.26.15',
        deps: [],
      },
    ],
  },
};

function mockResult(
  stdout: string,
  exitCode = 0,
  stderr = '',
): goBridge.GoCommandResult {
  return { exitCode, stdout, stderr };
}

describe('uv plugin', () => {
  const originalEnv = process.env;
  let execGoCommandSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv };
    execGoCommandSpy = jest
      .spyOn(goBridge, 'execGoCommand')
      .mockResolvedValue(mockResult(JSON.stringify(MOCK_DEP_GRAPH_DATA)));
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

    it('returns a valid result with the expected depGraph', async () => {
      const result = await inspect('.', 'uv.lock');

      expect(result.plugin).toEqual({
        name: 'snyk-uv-plugin',
        runtime: process.version,
        targetFile: 'uv.lock',
        packageManager: 'pip',
      });
      expect(result.scannedProjects).toHaveLength(1);

      const { depGraph } = result.scannedProjects[0];
      expect(depGraph).toBeDefined();
      expect(depGraph!.rootPkg).toEqual({
        name: 'uv-project',
        version: '0.1.0',
      });
      expect(depGraph!.pkgManager.name).toBe('pip');

      const depNames = depGraph!
        .getDepPkgs()
        .map((p) => p.name)
        .sort();
      expect(depNames).toEqual(['cffi', 'cryptography', 'urllib3']);
    });

    it('passes through the target file', async () => {
      const result = await inspect('.', 'path/to/uv.lock');

      expect(execGoCommandSpy).toHaveBeenCalledWith(
        [
          'depgraph',
          '--file=path/to/uv.lock',
          '--use-sbom-resolution',
          '--json',
        ],
        { cwd: '.' },
      );
      expect(result.plugin.targetFile).toBe('path/to/uv.lock');
      expect(result.scannedProjects[0].targetFile).toBe('path/to/uv.lock');
    });

    it('passes through org when provided in options', async () => {
      await inspect('.', 'uv.lock', { org: 'my-org' } as any);

      expect(execGoCommandSpy).toHaveBeenCalledWith(
        [
          'depgraph',
          '--file=uv.lock',
          '--use-sbom-resolution',
          '--json',
          '--org=my-org',
        ],
        { cwd: '.' },
      );
    });

    it('throws when dependency data is invalid JSON', async () => {
      execGoCommandSpy.mockResolvedValueOnce(mockResult('not-json'));

      const err: CustomError = await inspect('.', 'uv.lock').catch((e) => e);

      expect(err).toBeInstanceOf(CustomError);
      expect(err.userMessage).toBe('Unable to process dependency information');
      expect(err.message).toBe('Unable to process dependency information');
    });

    it('throws a generic error when command fails without parseable details', async () => {
      execGoCommandSpy.mockResolvedValueOnce(mockResult('not-json', 1, ''));

      const err: CustomError = await inspect('.', 'uv.lock').catch((e) => e);

      expect(err).toBeInstanceOf(CustomError);
      expect(err.userMessage).toBe('Unable to process dependency information');
      expect(err.message).toBe('Unable to process dependency information');
    });

    it('throws with the error detail from JSON stdout when command fails', async () => {
      const jsonError = JSON.stringify({
        ok: false,
        error:
          'uv version 0.4.0 is not supported. Minimum required version is 0.9.23',
        path: '/test',
      });
      execGoCommandSpy.mockResolvedValueOnce(mockResult(jsonError, 2));

      const err: CustomError = await inspect('.', 'uv.lock').catch((e) => e);

      expect(err).toBeInstanceOf(CustomError);
      expect(err.userMessage).toBe(
        'uv version 0.4.0 is not supported. Minimum required version is 0.9.23',
      );
      expect(err.message).toBe(
        'uv version 0.4.0 is not supported. Minimum required version is 0.9.23',
      );
    });

    it('throws with stderr when command fails and stdout is not JSON', async () => {
      execGoCommandSpy.mockResolvedValueOnce(
        mockResult('', 1, 'something went wrong'),
      );

      const err: CustomError = await inspect('.', 'uv.lock').catch((e) => e);

      expect(err).toBeInstanceOf(CustomError);
      expect(err.userMessage).toBe('something went wrong');
      expect(err.message).toBe('something went wrong');
    });

    it('attaches an error catalog entry for IPC propagation', async () => {
      const jsonError = JSON.stringify({
        ok: false,
        error: 'some depgraph failure',
        path: '/test',
      });
      execGoCommandSpy.mockResolvedValueOnce(mockResult(jsonError, 2));

      const err: CustomError = await inspect('.', 'uv.lock').catch((e) => e);

      expect(err).toBeInstanceOf(CustomError);
      const catalog = err.errorCatalog;
      expect(catalog).toBeInstanceOf(CLI.GeneralCLIFailureError);
      expect(catalog).toBeInstanceOf(ProblemError);
      expect(catalog!.detail).toBe('some depgraph failure');
    });

    it('attaches an error catalog entry for invalid JSON errors', async () => {
      execGoCommandSpy.mockResolvedValueOnce(mockResult('not-json', 0, ''));

      const err: CustomError = await inspect('.', 'uv.lock').catch((e) => e);

      const catalog = err.errorCatalog;
      expect(catalog).toBeInstanceOf(CLI.GeneralCLIFailureError);
      expect(catalog!.detail).toBe('Unable to process dependency information');
    });
  });
});
