import { getSinglePluginResult } from '../../../../../src/lib/plugins/get-single-plugin-result';
import {
  Options,
  TestOptions,
  MonitorOptions,
} from '../../../../../src/lib/types';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import * as pluginsModule from '../../../../../src/lib/plugins';
import { ModuleInfo } from '../../../../../src/lib/module-info';
import { hasFeatureFlagOrDefault } from '../../../../../src/lib/feature-flags';
import { snykHttpClient } from '../../../../../src/lib/request/snyk-http-client';
import {
  DISABLE_GO_PACKAGE_URLS_IN_CLI_FEATURE_FLAG,
  INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG,
} from '../../../../../src/lib/package-managers';

// Mock dependencies
jest.mock('../../../../../src/lib/plugins', () => ({
  loadPlugin: jest.fn(),
}));

jest.mock('../../../../../src/lib/module-info', () => ({
  ModuleInfo: jest.fn(),
}));

jest.mock('../../../../../src/lib/feature-flags', () => ({
  hasFeatureFlagOrDefault: jest.fn(),
}));

describe('getSinglePluginResult', () => {
  const mockPlugin = {} as any;
  const mockModuleInfo = {
    inspect: jest.fn(),
  } as any;
  const mockInspectResult: pluginApi.InspectResult = {
    plugin: { name: 'test-plugin' },
    package: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (pluginsModule.loadPlugin as jest.Mock).mockReturnValue(mockPlugin);
    (ModuleInfo as jest.Mock).mockReturnValue(mockModuleInfo);
    mockModuleInfo.inspect.mockResolvedValue(mockInspectResult);
  });

  describe('Go package managers', () => {
    it('should add configuration with includeGoStandardLibraryDeps=true when feature flag is enabled for gomodules', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'gomodules',
        showVulnPaths: 'some',
      };
      const featureFlags = new Set([
        INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG,
      ]);

      await getSinglePluginResult('/test', options, 'go.mod', featureFlags);

      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        'go.mod',
        expect.objectContaining({
          configuration: expect.objectContaining({
            includeGoStandardLibraryDeps: true,
          }),
        }),
        snykHttpClient,
      );
    });

    it('should add configuration with includeGoStandardLibraryDeps=false when feature flag is disabled for gomodules', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'gomodules',
        showVulnPaths: 'some',
      };
      const featureFlags = new Set<string>();

      await getSinglePluginResult('/test', options, 'go.mod', featureFlags);

      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        'go.mod',
        expect.objectContaining({
          configuration: expect.objectContaining({
            includeGoStandardLibraryDeps: false,
          }),
        }),
        snykHttpClient,
      );
    });

    it('should add configuration with includeGoStandardLibraryDeps=true when feature flag is enabled for golangdep', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'golangdep',
        showVulnPaths: 'some',
      };
      const featureFlags = new Set([
        INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG,
      ]);

      await getSinglePluginResult('/test', options, 'go.mod', featureFlags);

      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        'go.mod',
        expect.objectContaining({
          configuration: expect.objectContaining({
            includeGoStandardLibraryDeps: true,
          }),
        }),
        snykHttpClient,
      );
    });

    it('should enable PackageURLs in gomodules dep-graphs', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'gomodules',
        showVulnPaths: 'some',
      };
      const featureFlags = new Set<string>();

      await getSinglePluginResult('/test', options, 'go.mod', featureFlags);

      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        'go.mod',
        expect.objectContaining({
          configuration: expect.objectContaining({
            includePackageUrls: true,
          }),
        }),
        snykHttpClient,
      );
    });

    it('should disable PackageURLs in gomodules dep-graphs if the feature flag says so', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'gomodules',
        showVulnPaths: 'some',
      };
      const featureFlags = new Set<string>([
        DISABLE_GO_PACKAGE_URLS_IN_CLI_FEATURE_FLAG,
      ]);

      await getSinglePluginResult('/test', options, 'go.mod', featureFlags);

      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        'go.mod',
        expect.objectContaining({
          configuration: expect.objectContaining({
            includePackageUrls: false,
          }),
        }),
        snykHttpClient,
      );
    });

    it('should use targetFile when provided', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'gomodules',
        showVulnPaths: 'some',
        file: 'go.mod',
      };

      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(false);

      await getSinglePluginResult('/test', options, 'custom.go.mod');

      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        'custom.go.mod',
        expect.any(Object),
        snykHttpClient,
      );
    });

    it('should use options.file when targetFile is not provided', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'gomodules',
        showVulnPaths: 'some',
        file: 'go.mod',
      };

      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(false);

      await getSinglePluginResult('/test', options);

      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        'go.mod',
        expect.any(Object),
        snykHttpClient,
      );
    });
  });

  describe('Non-Go package managers', () => {
    it('should not add configuration for npm package manager', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'npm',
        showVulnPaths: 'some',
      };

      await getSinglePluginResult('/test', options);

      expect(hasFeatureFlagOrDefault).not.toHaveBeenCalled();
      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        undefined,
        expect.not.objectContaining({
          configuration: expect.objectContaining({
            includeGoStandardLibraryDeps: expect.anything(),
          }),
        }),
        snykHttpClient,
      );
    });

    it('should not add configuration for maven package manager', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'maven',
        showVulnPaths: 'some',
      };

      await getSinglePluginResult('/test', options);

      expect(hasFeatureFlagOrDefault).not.toHaveBeenCalled();
      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        undefined,
        expect.not.objectContaining({
          configuration: expect.objectContaining({
            includeGoStandardLibraryDeps: expect.anything(),
          }),
        }),
        snykHttpClient,
      );
    });
  });

  describe('MonitorOptions', () => {
    it('should work with MonitorOptions for gomodules', async () => {
      const options: Options & MonitorOptions = {
        path: '/test',
        packageManager: 'gomodules',
      };
      const featureFlags = new Set([
        INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG,
      ]);

      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(true);

      await getSinglePluginResult('/test', options, 'go.mod', featureFlags);

      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        'go.mod',
        expect.objectContaining({
          configuration: expect.objectContaining({
            includeGoStandardLibraryDeps: true,
          }),
        }),
        snykHttpClient,
      );
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from moduleInfo.inspect', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'gomodules',
        showVulnPaths: 'some',
      };

      const error = new Error('Inspect failed');
      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(false);
      mockModuleInfo.inspect.mockRejectedValue(error);

      await expect(getSinglePluginResult('/test', options)).rejects.toThrow(
        'Inspect failed',
      );
    });
  });

  describe('Return value', () => {
    it('should return the result from moduleInfo.inspect', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'gomodules',
        showVulnPaths: 'some',
      };

      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(false);

      const result = await getSinglePluginResult('/test', options);

      expect(result).toBe(mockInspectResult);
    });
  });
});
