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

      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(true);

      await getSinglePluginResult('/test', options);

      expect(hasFeatureFlagOrDefault).toHaveBeenCalledWith(
        'includeGoStandardLibraryDeps',
        options,
        false,
      );
      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        undefined,
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

      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(false);

      await getSinglePluginResult('/test', options);

      expect(hasFeatureFlagOrDefault).toHaveBeenCalledWith(
        'includeGoStandardLibraryDeps',
        options,
        false,
      );
      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        undefined,
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

      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(true);

      await getSinglePluginResult('/test', options);

      expect(hasFeatureFlagOrDefault).toHaveBeenCalledWith(
        'includeGoStandardLibraryDeps',
        options,
        false,
      );
      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        undefined,
        expect.objectContaining({
          configuration: expect.objectContaining({
            includeGoStandardLibraryDeps: true,
          }),
        }),
        snykHttpClient,
      );
    });

    it('should preserve existing configuration properties when adding includeGoStandardLibraryDeps', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'gomodules',
        showVulnPaths: 'some',
        configuration: {
          includePackageUrls: true,
        },
      };

      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(true);

      await getSinglePluginResult('/test', options);

      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        undefined,
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

      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(false);

      await getSinglePluginResult('/test', options);

      expect(hasFeatureFlagOrDefault).toHaveBeenCalledWith(
        'disableGoPackageUrlsInCli',
        options,
        false,
      );
      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        undefined,
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

      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(true);

      await getSinglePluginResult('/test', options);

      expect(hasFeatureFlagOrDefault).toHaveBeenCalledWith(
        'disableGoPackageUrlsInCli',
        options,
        false,
      );
      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        undefined,
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

    it('should preserve existing configuration for non-Go package managers', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'npm',
        showVulnPaths: 'some',
        configuration: {
          includePackageUrls: true,
        },
      };

      await getSinglePluginResult('/test', options);

      expect(hasFeatureFlagOrDefault).not.toHaveBeenCalled();
      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        undefined,
        expect.objectContaining({
          configuration: {
            includePackageUrls: true,
          },
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

      (hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(true);

      await getSinglePluginResult('/test', options);

      expect(hasFeatureFlagOrDefault).toHaveBeenCalledWith(
        'includeGoStandardLibraryDeps',
        options,
        false,
      );
      expect(mockModuleInfo.inspect).toHaveBeenCalledWith(
        '/test',
        undefined,
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
    it('should propagate errors from hasFeatureFlagOrDefault', async () => {
      const options: Options & TestOptions = {
        path: '/test',
        packageManager: 'gomodules',
        showVulnPaths: 'some',
      };

      const error = new Error('Feature flag check failed');
      (hasFeatureFlagOrDefault as jest.Mock).mockRejectedValue(error);

      await expect(getSinglePluginResult('/test', options)).rejects.toThrow(
        'Feature flag check failed',
      );
    });

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
