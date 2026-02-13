import {
  isPathToPackageFile,
  detectPackageManagerFromFile,
} from '../../../src/lib/detect';
import {
  UV_FEATURE_FLAG,
  UV_MONITOR_ENABLED_ENV_VAR,
} from '../../../src/lib/package-managers';
import { loadPlugin } from '../../../src/lib/plugins';

describe('uv detection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isPathToPackageFile', () => {
    it('rejects uv.lock when neither feature flag nor env var are set', () => {
      delete process.env[UV_MONITOR_ENABLED_ENV_VAR];
      expect(isPathToPackageFile('uv.lock')).toBe(false);
    });

    it('rejects uv.lock when only the feature flag is set', () => {
      delete process.env[UV_MONITOR_ENABLED_ENV_VAR];
      const flags = new Set([UV_FEATURE_FLAG]);
      expect(isPathToPackageFile('uv.lock', flags)).toBe(false);
    });

    it('rejects uv.lock when only the env var is set', () => {
      process.env[UV_MONITOR_ENABLED_ENV_VAR] = 'true';
      expect(isPathToPackageFile('uv.lock')).toBe(false);
    });

    it('accepts uv.lock when both feature flag and env var are set', () => {
      process.env[UV_MONITOR_ENABLED_ENV_VAR] = 'true';
      const flags = new Set([UV_FEATURE_FLAG]);
      expect(isPathToPackageFile('uv.lock', flags)).toBe(true);
    });

    it('accepts nested uv.lock when both feature flag and env var are set', () => {
      process.env[UV_MONITOR_ENABLED_ENV_VAR] = 'true';
      const flags = new Set([UV_FEATURE_FLAG]);
      expect(isPathToPackageFile('some/nested/uv.lock', flags)).toBe(true);
    });
  });

  describe('detectPackageManagerFromFile', () => {
    it('throws when neither feature flag nor env var are set', () => {
      delete process.env[UV_MONITOR_ENABLED_ENV_VAR];
      expect(() => detectPackageManagerFromFile('uv.lock')).toThrow(
        'Could not detect package manager for file: uv.lock',
      );
    });

    it('throws when only the feature flag is set', () => {
      delete process.env[UV_MONITOR_ENABLED_ENV_VAR];
      const flags = new Set([UV_FEATURE_FLAG]);
      expect(() => detectPackageManagerFromFile('uv.lock', flags)).toThrow(
        'Could not detect package manager for file: uv.lock',
      );
    });

    it('throws when only the env var is set', () => {
      process.env[UV_MONITOR_ENABLED_ENV_VAR] = 'true';
      expect(() => detectPackageManagerFromFile('uv.lock')).toThrow(
        'Could not detect package manager for file: uv.lock',
      );
    });

    it('returns uv when both feature flag and env var are set', () => {
      process.env[UV_MONITOR_ENABLED_ENV_VAR] = 'true';
      const flags = new Set([UV_FEATURE_FLAG]);
      expect(detectPackageManagerFromFile('uv.lock', flags)).toBe('uv');
    });

    it('returns uv for nested lockfile when both feature flag and env var are set', () => {
      process.env[UV_MONITOR_ENABLED_ENV_VAR] = 'true';
      const flags = new Set([UV_FEATURE_FLAG]);
      expect(detectPackageManagerFromFile('some/nested/uv.lock', flags)).toBe(
        'uv',
      );
    });
  });

  describe('loadPlugin', () => {
    it('returns the uv plugin', () => {
      const plugin = loadPlugin('uv');
      expect(plugin).toBeDefined();
      expect(typeof plugin.inspect).toBe('function');
    });
  });
});
