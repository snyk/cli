import * as path from 'path';
import {
  isPathToPackageFile,
  detectPackageManagerFromFile,
} from '../../detect';
import { find } from '../../find-files';
import { UV_FEATURE_FLAG } from '../../package-managers';
import { loadPlugin } from '..';

describe('uv detection', () => {
  describe('isPathToPackageFile', () => {
    it('rejects uv.lock when feature flag is not set', () => {
      expect(isPathToPackageFile('uv.lock')).toBe(false);
    });

    it('accepts uv.lock when the feature flag is set', () => {
      const flags = new Set([UV_FEATURE_FLAG]);
      expect(isPathToPackageFile('uv.lock', flags)).toBe(true);
    });

    it('accepts nested uv.lock when the feature flag is set', () => {
      const flags = new Set([UV_FEATURE_FLAG]);
      expect(isPathToPackageFile('some/nested/uv.lock', flags)).toBe(true);
    });
  });

  describe('detectPackageManagerFromFile', () => {
    it('throws when feature flag is not set', () => {
      expect(() => detectPackageManagerFromFile('uv.lock')).toThrow(
        'Could not detect package manager for file: uv.lock',
      );
    });

    it('returns uv when the feature flag is set', () => {
      const flags = new Set([UV_FEATURE_FLAG]);
      expect(detectPackageManagerFromFile('uv.lock', flags)).toBe('uv');
    });

    it('returns uv for nested lockfile when the feature flag is set', () => {
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

  describe('find with uv.lock', () => {
    const uvFixturePath = path.resolve(
      __dirname,
      '../../../../test/fixtures/uv-acceptance',
    );

    it('filters out uv.lock when feature flag is not set', async () => {
      const { files } = await find({
        path: uvFixturePath,
        filter: ['uv.lock'],
        levelsDeep: 1,
      });
      expect(files).toEqual([]);
    });

    it('returns uv.lock when feature flag is set', async () => {
      const { files } = await find({
        path: uvFixturePath,
        filter: ['uv.lock'],
        levelsDeep: 1,
        featureFlags: new Set([UV_FEATURE_FLAG]),
      });
      expect(files).toEqual([path.join(uvFixturePath, 'uv.lock')]);
    });
  });
});
