import { inspect, UV_MONITOR_ENABLED_ENV_VAR } from './index';

describe('uv plugin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
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

      expect(result.plugin.targetFile).toBe('path/to/uv.lock');
      expect(result.scannedProjects[0].targetFile).toBe('path/to/uv.lock');
    });
  });
});
