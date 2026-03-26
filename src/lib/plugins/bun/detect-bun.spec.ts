import * as path from 'path';
import {
  isPathToPackageFile,
  detectPackageManagerFromFile,
} from '../../detect';
import { find } from '../../find-files';
import { BUN_FEATURE_FLAG } from '../../package-managers';
import { loadPlugin } from '..';

describe('bun detection', () => {
  describe('isPathToPackageFile', () => {
    it('rejects bun.lock when feature flag is not set', () => {
      expect(isPathToPackageFile('bun.lock')).toBe(false);
    });

    it('accepts bun.lock when the feature flag is set', () => {
      const flags = new Set([BUN_FEATURE_FLAG]);
      expect(isPathToPackageFile('bun.lock', flags)).toBe(true);
    });

    it('accepts nested bun.lock when the feature flag is set', () => {
      const flags = new Set([BUN_FEATURE_FLAG]);
      expect(isPathToPackageFile('some/nested/bun.lock', flags)).toBe(true);
    });
  });

  describe('detectPackageManagerFromFile', () => {
    it('throws when feature flag is not set', () => {
      expect(() => detectPackageManagerFromFile('bun.lock')).toThrow(
        'Could not detect package manager for file: bun.lock',
      );
    });

    it('returns bun when the feature flag is set', () => {
      const flags = new Set([BUN_FEATURE_FLAG]);
      expect(detectPackageManagerFromFile('bun.lock', flags)).toBe('bun');
    });

    it('returns bun for nested lockfile when the feature flag is set', () => {
      const flags = new Set([BUN_FEATURE_FLAG]);
      expect(
        detectPackageManagerFromFile('some/nested/bun.lock', flags),
      ).toBe('bun');
    });
  });

  describe('loadPlugin', () => {
    it('returns the bun plugin', () => {
      const plugin = loadPlugin('bun');
      expect(plugin).toBeDefined();
      expect(typeof plugin.inspect).toBe('function');
    });
  });

  describe('find with bun.lock', () => {
    const bunFixturePath = path.resolve(
      __dirname,
      '../../../../test/fixtures/bun-app',
    );

    it('filters out bun.lock when feature flag is not set', async () => {
      const { files } = await find({
        path: bunFixturePath,
        filter: ['bun.lock'],
        levelsDeep: 1,
      });
      expect(files).toEqual([]);
    });

    it('returns bun.lock when feature flag is set', async () => {
      const { files } = await find({
        path: bunFixturePath,
        filter: ['bun.lock'],
        levelsDeep: 1,
        featureFlags: new Set([BUN_FEATURE_FLAG]),
      });
      expect(files).toEqual([path.join(bunFixturePath, 'bun.lock')]);
    });
  });
});
