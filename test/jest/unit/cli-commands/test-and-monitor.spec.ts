import monitor from '../../../../src/cli/commands/monitor';
import * as featureFlags from '../../../../src/lib/feature-flags';
import { CLI_DOTNET_RUNTIME_RESOLUTION } from '../../../../src/lib/feature-flags';
import {
  SCAN_USR_LIB_JARS_FEATURE_FLAG,
  DISABLE_CONTAINER_MONITOR_PROJECT_NAME_FIX_FEATURE_FLAG,
  INCLUDE_SYSTEM_JARS_OPTION,
  EXCLUDE_APP_VULNS_OPTION,
} from '../../../../src/cli/commands/constants';
import * as ecosystems from '../../../../src/lib/ecosystems';
import * as analytics from '../../../../src/lib/analytics';
import config from '../../../../src/lib/config';
import { apiOrOAuthTokenExists } from '../../../../src/lib/api-token';
import { runTest } from '../../../../src/lib/snyk-test/run-test';
import { getDepsFromPlugin } from '../../../../src/lib/plugins/get-deps-from-plugin';
import * as detect from '../../../../src/lib/detect';
import test from '../../../../src/cli/commands/test';

jest.mock('../../../../src/lib/api-token');
jest.mock('../../../../src/lib/check-paths');
jest.mock('../../../../src/lib/detect');
jest.mock('../../../../src/lib/formatters');
jest.mock('../../../../src/lib/plugins/get-deps-from-plugin');
jest.mock('../../../../src/lib/spinner');
jest.mock('../../../../src/lib/snyk-test/run-test');
jest.mock('../../../../src/lib/analytics');
jest.mock('../../../../src/lib/monitor');
jest.mock('../../../../src/lib/feature-flags');
jest.mock('../../../../src/lib/protect-update-notification', () => ({
  getPackageJsonPathsContainingSnykDependency: jest.fn(() => []),
  getProtectUpgradeWarningForPaths: jest.fn(() => ''),
}));
jest.mock('../../../../src/cli/commands/test/validate-credentials', () => ({
  validateCredentials: jest.fn(),
}));
jest.mock('../../../../src/cli/commands/test/validate-test-options', () => ({
  validateTestOptions: jest.fn(),
}));
jest.mock('../../../../src/lib/ecosystems', () => ({
  getEcosystem: jest.fn(() => undefined),
  getEcosystemForTest: jest.fn(() => undefined),
}));
jest.mock('../../../../src/lib/snyk-test/legacy', () => ({
  test: jest.fn(() => Promise.resolve({})),
}));

describe('monitor & test', () => {
  beforeEach(() => {
    (apiOrOAuthTokenExists as jest.Mock).mockReturnValue(true);
    (featureFlags.hasFeatureFlag as jest.Mock).mockResolvedValue(false);
    (featureFlags.isFeatureFlagSupportedForOrg as jest.Mock).mockResolvedValue({
      ok: false,
    });

    // mock config values
    Object.defineProperty(config, 'PROJECT_NAME', {
      value: 'default-project-name',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('docker scanUsrLibJars feature flag', () => {
    beforeEach(() => {
      (ecosystems.getEcosystem as jest.Mock).mockReturnValue(undefined);
      (analytics.allowAnalytics as jest.Mock).mockReturnValue(false);
    });

    describe('test command', () => {
      let capturedOptions: any = null;

      beforeEach(() => {
        (ecosystems.getEcosystemForTest as jest.Mock).mockReturnValue(null);
        capturedOptions = null;
        (runTest as jest.Mock).mockImplementation(
          (projectType, root, options) => {
            capturedOptions = options;
            return Promise.resolve([]);
          },
        );
        (detect.detectPackageManager as jest.Mock).mockReturnValue('docker');
      });

      it('should set include-system-jars when scanUsrLibJars feature flag is enabled', async () => {
        const options: any = {
          docker: true,
          [EXCLUDE_APP_VULNS_OPTION]: true, // Skip containerCliAppVulnsEnabled check
        };

        // Mock feature flag responses - need to handle multiple calls
        (featureFlags.hasFeatureFlag as jest.Mock).mockImplementation(
          (flag: string) => {
            if (flag === SCAN_USR_LIB_JARS_FEATURE_FLAG) {
              return Promise.resolve(true);
            }
            return Promise.resolve(false); // Default for other flags
          },
        );
        (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockImplementation(
          (flag: string) => {
            if (flag === SCAN_USR_LIB_JARS_FEATURE_FLAG) {
              return Promise.resolve(true);
            }
            return Promise.resolve(false); // Default for other flags
          },
        );

        try {
          await test('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlags.hasFeatureFlagOrDefault).toHaveBeenCalledWith(
          SCAN_USR_LIB_JARS_FEATURE_FLAG,
          expect.objectContaining({
            docker: true,
          }),
          false,
        );

        // Verify that include-system-jars was set on the internal options object passed to runTest
        expect(capturedOptions).toBeTruthy();
        expect(capturedOptions[INCLUDE_SYSTEM_JARS_OPTION]).toBe(true);
      });

      it('should not set include-system-jars when scanUsrLibJars feature flag is disabled', async () => {
        const options: any = {
          docker: true,
          [EXCLUDE_APP_VULNS_OPTION]: true, // Skip containerCliAppVulnsEnabled check
        };

        // Mock feature flag responses - need to handle multiple calls
        (featureFlags.hasFeatureFlag as jest.Mock).mockImplementation(() => {
          return Promise.resolve(false); // All flags disabled
        });
        (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockImplementation(
          () => {
            return Promise.resolve(false); // All flags disabled
          },
        );

        try {
          await test('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlags.hasFeatureFlagOrDefault).toHaveBeenCalledWith(
          SCAN_USR_LIB_JARS_FEATURE_FLAG,
          expect.objectContaining({
            docker: true,
          }),
          false,
        );

        // Verify that include-system-jars was NOT set when the feature flag is disabled
        expect(options[INCLUDE_SYSTEM_JARS_OPTION]).toBeUndefined();
      });

      it('should not check scanUsrLibJars feature flag for non-docker scans', async () => {
        const options: any = {
          docker: false,
        };

        try {
          await test('path/to/project', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the options being set correctly.
        }

        expect(featureFlags.hasFeatureFlagOrDefault).not.toHaveBeenCalledWith(
          SCAN_USR_LIB_JARS_FEATURE_FLAG,
          options,
          false,
        );
        expect(options[INCLUDE_SYSTEM_JARS_OPTION]).toBeUndefined();
      });
    });

    describe('monitor command', () => {
      it('should set include-system-jars when scanUsrLibJars feature flag is enabled', async () => {
        const options: any = {
          docker: true,
          [EXCLUDE_APP_VULNS_OPTION]: true, // Skip containerCliAppVulnsEnabled check
        };

        // Mock feature flag responses - need to handle multiple calls
        (featureFlags.hasFeatureFlag as jest.Mock).mockImplementation(
          (flag: string) => {
            if (flag === SCAN_USR_LIB_JARS_FEATURE_FLAG) {
              return Promise.resolve(true);
            }
            return Promise.resolve(false); // Default for other flags
          },
        );
        (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockImplementation(
          (flag: string) => {
            if (flag === SCAN_USR_LIB_JARS_FEATURE_FLAG) {
              return Promise.resolve(true);
            }
            return Promise.resolve(false); // Default for other flags
          },
        );

        try {
          await monitor('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlags.hasFeatureFlagOrDefault).toHaveBeenCalledWith(
          SCAN_USR_LIB_JARS_FEATURE_FLAG,
          expect.objectContaining({
            docker: true,
          }),
          false,
        );

        // Verify that include-system-jars was set on the options object
        expect(options[INCLUDE_SYSTEM_JARS_OPTION]).toBe(true);
      });

      it('should not set include-system-jars when scanUsrLibJars feature flag is disabled', async () => {
        const options: any = {
          docker: true,
          [EXCLUDE_APP_VULNS_OPTION]: true, // Skip containerCliAppVulnsEnabled check
        };

        // Mock feature flag responses - need to handle multiple calls
        (featureFlags.hasFeatureFlag as jest.Mock).mockImplementation(() => {
          return Promise.resolve(false); // All flags disabled
        });
        (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockImplementation(
          () => {
            return Promise.resolve(false); // All flags disabled
          },
        );

        try {
          await monitor('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlags.hasFeatureFlagOrDefault).toHaveBeenCalledWith(
          SCAN_USR_LIB_JARS_FEATURE_FLAG,
          expect.objectContaining({
            docker: true,
          }),
          false,
        );

        // Verify that include-system-jars was NOT set when the feature flag is disabled
        expect(options[INCLUDE_SYSTEM_JARS_OPTION]).toBeUndefined();
      });

      it('should not check scanUsrLibJars feature flag for non-docker scans', async () => {
        const options: any = {
          docker: false,
        };

        try {
          await monitor('path/to/project', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the options being set correctly.
        }

        expect(featureFlags.hasFeatureFlagOrDefault).not.toHaveBeenCalledWith(
          SCAN_USR_LIB_JARS_FEATURE_FLAG,
          options,
          false,
        );
        expect(options[INCLUDE_SYSTEM_JARS_OPTION]).toBeUndefined();
      });
    });
  });

  describe('docker disableContainerMonitorProjectNameFix feature flag', () => {
    beforeEach(() => {
      (ecosystems.getEcosystem as jest.Mock).mockReturnValue(undefined);
      (analytics.allowAnalytics as jest.Mock).mockReturnValue(false);
    });

    describe('monitor command', () => {
      it('should set disableContainerMonitorProjectNameFix on options when feature flag is enabled (to revert to legacy behavior)', async () => {
        const options: any = {
          docker: true,
          [EXCLUDE_APP_VULNS_OPTION]: true,
        };

        (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockImplementation(
          (flag: string) => {
            if (
              flag === DISABLE_CONTAINER_MONITOR_PROJECT_NAME_FIX_FEATURE_FLAG
            ) {
              return Promise.resolve(true);
            }
            return Promise.resolve(false);
          },
        );

        try {
          await monitor('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlags.hasFeatureFlagOrDefault).toHaveBeenCalledWith(
          DISABLE_CONTAINER_MONITOR_PROJECT_NAME_FIX_FEATURE_FLAG,
          expect.objectContaining({
            docker: true,
          }),
          false,
        );

        // When flag is enabled, it triggers legacy behavior (using id instead of projectName)
        expect(options.disableContainerMonitorProjectNameFix).toBe(true);
      });

      it('should not set disableContainerMonitorProjectNameFix on options by default (uses new correct behavior)', async () => {
        const options: any = {
          docker: true,
          [EXCLUDE_APP_VULNS_OPTION]: true,
        };

        (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockImplementation(
          () => {
            return Promise.resolve(false);
          },
        );

        try {
          await monitor('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlags.hasFeatureFlagOrDefault).toHaveBeenCalledWith(
          DISABLE_CONTAINER_MONITOR_PROJECT_NAME_FIX_FEATURE_FLAG,
          expect.objectContaining({
            docker: true,
          }),
          false,
        );

        // When flag is not set, uses new correct behavior (projectName)
        expect(options.disableContainerMonitorProjectNameFix).toBeUndefined();
      });

      it('should not check disableContainerMonitorProjectNameFix feature flag for non-docker scans', async () => {
        const options: any = {
          docker: false,
        };

        try {
          await monitor('path/to/project', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the options being set correctly.
        }

        expect(featureFlags.hasFeatureFlagOrDefault).not.toHaveBeenCalledWith(
          DISABLE_CONTAINER_MONITOR_PROJECT_NAME_FIX_FEATURE_FLAG,
          options,
          false,
        );
        expect(options.disableContainerMonitorProjectNameFix).toBeUndefined();
      });
    });
  });

  describe('cliDotnetRuntimeResolution feature flag', () => {
    beforeEach(() => {
      (ecosystems.getEcosystem as jest.Mock).mockReturnValue(undefined);
      (analytics.allowAnalytics as jest.Mock).mockReturnValue(false);
      (
        featureFlags.isFeatureFlagSupportedForOrg as jest.Mock
      ).mockResolvedValue({
        ok: false,
      });
    });

    describe('test command', () => {
      let capturedOptions: any = null;
      let capturedFeatureFlags: Set<string> = new Set<string>();

      beforeEach(() => {
        (ecosystems.getEcosystemForTest as jest.Mock).mockReturnValue(null);
        capturedOptions = null;
        capturedFeatureFlags = new Set<string>();
        (runTest as jest.Mock).mockImplementation(
          (_projectType, _root, options, featureFlags) => {
            capturedOptions = options;
            capturedFeatureFlags = featureFlags;
            return Promise.resolve([]);
          },
        );
        (detect.detectPackageManager as jest.Mock).mockReturnValue('nuget');
      });

      it('should add CLI_DOTNET_RUNTIME_RESOLUTION to featureFlags when FF is enabled', async () => {
        const options: any = {};
        (
          featureFlags.isFeatureFlagSupportedForOrg as jest.Mock
        ).mockImplementation((flag) => {
          return Promise.resolve({
            ok: flag === CLI_DOTNET_RUNTIME_RESOLUTION,
          });
        });

        try {
          await test('path/to/project', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
        }

        expect(capturedFeatureFlags?.has(CLI_DOTNET_RUNTIME_RESOLUTION)).toBe(
          true,
        );
        expect(capturedOptions['dotnet-runtime-resolution']).toBeUndefined();
      });

      it('should not add CLI_DOTNET_RUNTIME_RESOLUTION to featureFlags when FF is disabled', async () => {
        const options: any = {};

        try {
          await test('path/to/project', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
        }

        expect(capturedFeatureFlags?.has(CLI_DOTNET_RUNTIME_RESOLUTION)).toBe(
          false,
        );
        expect(capturedOptions['dotnet-runtime-resolution']).toBeUndefined();
      });
    });

    describe('monitor command', () => {
      let capturedOptions: any = null;
      let capturedFeatureFlags: Set<string> = new Set<string>();

      beforeEach(() => {
        capturedOptions = null;
        capturedFeatureFlags = new Set<string>();
        (analytics.allowAnalytics as jest.Mock).mockReturnValue(false);
        (detect.detectPackageManager as jest.Mock).mockReturnValue('nuget');
        (detect.detectPackageFile as jest.Mock).mockReturnValue(
          'project.assets.json',
        );
        (getDepsFromPlugin as jest.Mock).mockImplementation(
          (_root, options, featureFlags) => {
            capturedOptions = options;
            capturedFeatureFlags = featureFlags;
            return Promise.resolve({
              plugin: { name: 'snyk-nuget-plugin' },
              scannedProjects: [],
            });
          },
        );
      });

      it('should add CLI_DOTNET_RUNTIME_RESOLUTION to featureFlags when FF is enabled', async () => {
        const options: any = {};
        (
          featureFlags.isFeatureFlagSupportedForOrg as jest.Mock
        ).mockImplementation((flag) => {
          return Promise.resolve({
            ok: flag === CLI_DOTNET_RUNTIME_RESOLUTION,
          });
        });

        try {
          await monitor(process.cwd(), options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
        }

        expect(capturedFeatureFlags?.has(CLI_DOTNET_RUNTIME_RESOLUTION)).toBe(
          true,
        );
        expect(capturedOptions['dotnet-runtime-resolution']).toBeUndefined();
      });

      it('should not add CLI_DOTNET_RUNTIME_RESOLUTION to featureFlags when FF is disabled', async () => {
        const options: any = {};

        try {
          await monitor(process.cwd(), options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
        }

        expect(capturedFeatureFlags?.has(CLI_DOTNET_RUNTIME_RESOLUTION)).toBe(
          false,
        );
        expect(capturedOptions['dotnet-runtime-resolution']).toBeUndefined();
      });
    });
  });
});
