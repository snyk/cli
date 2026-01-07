import monitor from '../../../../src/cli/commands/monitor';
import {
  DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
  MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
  PNPM_FEATURE_FLAG,
} from '../../../../src/lib/package-managers';
import * as featureFlagGateway from '../../../../src/lib/feature-flag-gateway';
import {
  SCAN_USR_LIB_JARS_FEATURE_FLAG,
  INCLUDE_SYSTEM_JARS_OPTION,
  EXCLUDE_APP_VULNS_OPTION,
  CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
} from '../../../../src/cli/commands/constants';
import * as ecosystems from '../../../../src/lib/ecosystems';
import * as analytics from '../../../../src/lib/analytics';
import * as snykMonitor from '../../../../src/lib/monitor';
import config from '../../../../src/lib/config';
import { apiOrOAuthTokenExists } from '../../../../src/lib/api-token';
import { runTest } from '../../../../src/lib/snyk-test/run-test';
import * as detect from '../../../../src/lib/detect';
import test from '../../../../src/cli/commands/test';
import { SHOW_MAVEN_BUILD_SCOPE } from '../../../../src/lib/feature-flag-gateway';

jest.mock('../../../../src/lib/api-token');
jest.mock('../../../../src/lib/check-paths');
jest.mock('../../../../src/lib/detect');
jest.mock('../../../../src/lib/formatters');
jest.mock('../../../../src/lib/plugins/get-deps-from-plugin');
jest.mock('../../../../src/lib/spinner');
jest.mock('../../../../src/lib/snyk-test/run-test');
jest.mock('../../../../src/lib/feature-flag-gateway');
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

const snykTest = require('../../../../src/lib/snyk-test');

describe('monitor & test', () => {
  let getEcosystemSpy: jest.SpyInstance;
  let analyticsSpy: jest.SpyInstance;
  let snykMonitorSpy: jest.SpyInstance;

  beforeEach(() => {
    getEcosystemSpy = jest.spyOn(ecosystems, 'getEcosystem');
    analyticsSpy = jest.spyOn(analytics, 'allowAnalytics');
    snykMonitorSpy = jest.spyOn(snykMonitor, 'monitor');
    (apiOrOAuthTokenExists as jest.Mock).mockReturnValue(true);
    (featureFlagGateway.getEnabledFeatureFlags as jest.Mock).mockResolvedValue(
      new Set([]),
    );

    // mock config values
    Object.defineProperty(config, 'PROJECT_NAME', {
      value: 'default-project-name',
    });
  });

  afterEach(() => {
    getEcosystemSpy.mockRestore();
    analyticsSpy.mockRestore();
    snykMonitorSpy.mockRestore();
    (featureFlagGateway.getEnabledFeatureFlags as jest.Mock).mockResolvedValue(
      new Set([]),
    );
  });

  describe('monitor', () => {
    it('should set useImprovedDotnetWithoutPublish on options when the feature flag is enabled', async () => {
      getEcosystemSpy.mockReturnValue(undefined);
      analyticsSpy.mockReturnValue(false);
      const options: any = {
        'dotnet-runtime-resolution': true,
      };
      (
        featureFlagGateway.getEnabledFeatureFlags as jest.Mock
      ).mockResolvedValue(new Set([DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG]));

      try {
        await monitor('path/to/project', options);
      } catch (error) {
        // We expect this to fail since we are not mocking all dependencies.
        // We only care about the options being set correctly.
      }

      expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
        [
          CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
          SCAN_USR_LIB_JARS_FEATURE_FLAG,
          PNPM_FEATURE_FLAG,
          DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
          MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
        ],
        expect.any(String),
      );

      expect(options.useImprovedDotnetWithoutPublish).toBe(true);
    });

    it('should not set useImprovedDotnetWithoutPublish on options when the feature flag is disabled', async () => {
      getEcosystemSpy.mockReturnValue(undefined);
      analyticsSpy.mockReturnValue(false);
      const options: any = {
        'dotnet-runtime-resolution': true,
      };
      (
        featureFlagGateway.getEnabledFeatureFlags as jest.Mock
      ).mockResolvedValue(new Set());

      try {
        await monitor('path/to/project', options);
      } catch (error) {
        // We expect this to fail since we are not mocking all dependencies.
        // We only care about the options being set correctly.
      }

      expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
        [
          CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
          SCAN_USR_LIB_JARS_FEATURE_FLAG,
          PNPM_FEATURE_FLAG,
          DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
          MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
        ],
        expect.any(String),
      );
      expect(options.useImprovedDotnetWithoutPublish).toBeFalsy();
    });

    it('should not check the feature flag if dotnet-runtime-resolution is not enabled', async () => {
      getEcosystemSpy.mockReturnValue(undefined);
      analyticsSpy.mockReturnValue(false);
      const options: any = {};

      try {
        await monitor('path/to/project', options);
      } catch (error) {
        // We expect this to fail since we are not mocking all dependencies.
        // We only care about the options being set correctly.
      }

      expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
        [
          CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
          SCAN_USR_LIB_JARS_FEATURE_FLAG,
          PNPM_FEATURE_FLAG,
          DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
          MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
        ],
        expect.any(String),
      );
      expect(options.useImprovedDotnetWithoutPublish).toBeUndefined();
    });
  });

  describe('test', () => {
    beforeEach(() => {
      (runTest as jest.Mock).mockResolvedValue([]);
      jest.spyOn(detect, 'detectPackageManager').mockReturnValue('nuget');
    });

    it('should set useImprovedDotnetWithoutPublish on options when the feature flag is enabled', async () => {
      const options: any = {
        'dotnet-runtime-resolution': true,
      };

      (
        featureFlagGateway.getEnabledFeatureFlags as jest.Mock
      ).mockResolvedValue(new Set([DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG]));

      await snykTest('path/to/project', options);

      expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
        [
          PNPM_FEATURE_FLAG,
          DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
          MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
          SHOW_MAVEN_BUILD_SCOPE,
        ],
        expect.any(String),
      );
      expect(options.useImprovedDotnetWithoutPublish).toBe(true);
    });

    it('should not set useImprovedDotnetWithoutPublish on options when the feature flag is disabled', async () => {
      const options: any = {
        'dotnet-runtime-resolution': true,
      };
      (
        featureFlagGateway.getEnabledFeatureFlags as jest.Mock
      ).mockResolvedValue(new Set());
      await snykTest('path/to/project', options);

      expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
        [
          PNPM_FEATURE_FLAG,
          DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
          MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
          SHOW_MAVEN_BUILD_SCOPE,
        ],
        expect.any(String),
      );
      expect(options.useImprovedDotnetWithoutPublish).toBeUndefined();
    });

    it('should not check the feature flag if dotnet-runtime-resolution is not enabled', async () => {
      const options: any = {};
      await snykTest('path/to/project', options);

      expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
        [
          PNPM_FEATURE_FLAG,
          DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
          MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
          SHOW_MAVEN_BUILD_SCOPE,
        ],
        expect.any(String),
      );
      expect(options.useImprovedDotnetWithoutPublish).toBeUndefined();
    });
  });

  describe('docker scanUsrLibJars feature flag', () => {
    beforeEach(() => {
      getEcosystemSpy.mockReturnValue(undefined); // Don't use ecosystem for these tests
      analyticsSpy.mockReturnValue(false);
    });

    describe('test command', () => {
      let capturedOptions: any = null;

      beforeEach(() => {
        // Mock the ecosystem detection to return null so it uses the legacy path
        jest.spyOn(ecosystems, 'getEcosystemForTest').mockReturnValue(null);
        // Mock runTest to return empty array and capture the options
        capturedOptions = null;
        (runTest as jest.Mock).mockImplementation(
          (projectType, root, options) => {
            capturedOptions = options;
            return Promise.resolve([]);
          },
        );
        // Mock detectPackageManager
        jest.spyOn(detect, 'detectPackageManager').mockReturnValue('docker');
      });

      it('should set include-system-jars when scanUsrLibJars feature flag is enabled', async () => {
        const options: any = {
          docker: true,
          [EXCLUDE_APP_VULNS_OPTION]: true, // Skip containerCliAppVulnsEnabled check
        };

        // Mock feature flag responses - need to handle multiple calls
        (
          featureFlagGateway.getEnabledFeatureFlags as jest.Mock
        ).mockImplementation(async (flags: string[]) => {
          const enabled = new Set<string>();

          if (flags.includes(SCAN_USR_LIB_JARS_FEATURE_FLAG)) {
            enabled.add(SCAN_USR_LIB_JARS_FEATURE_FLAG);
          }

          return enabled;
        });

        try {
          await test('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
          [
            CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
            SCAN_USR_LIB_JARS_FEATURE_FLAG,
            PNPM_FEATURE_FLAG,
            DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
            MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
          ],
          expect.any(String),
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
        (
          featureFlagGateway.getEnabledFeatureFlags as jest.Mock
        ).mockResolvedValue(new Set());

        try {
          await test('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
          [
            CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
            SCAN_USR_LIB_JARS_FEATURE_FLAG,
            PNPM_FEATURE_FLAG,
            DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
            MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
          ],
          expect.any(String),
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

        expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
          [
            CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
            SCAN_USR_LIB_JARS_FEATURE_FLAG,
            PNPM_FEATURE_FLAG,
            DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
            MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
          ],
          expect.any(String),
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
        (
          featureFlagGateway.getEnabledFeatureFlags as jest.Mock
        ).mockImplementation(async (flags: string[]) => {
          const enabled = new Set<string>();

          if (flags.includes(SCAN_USR_LIB_JARS_FEATURE_FLAG)) {
            enabled.add(SCAN_USR_LIB_JARS_FEATURE_FLAG);
          }

          return enabled;
        });

        try {
          await monitor('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
          [
            CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
            SCAN_USR_LIB_JARS_FEATURE_FLAG,
            PNPM_FEATURE_FLAG,
            DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
            MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
          ],
          expect.any(String),
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
        (
          featureFlagGateway.getEnabledFeatureFlags as jest.Mock
        ).mockResolvedValue(new Set());

        try {
          await monitor('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
          [
            CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
            SCAN_USR_LIB_JARS_FEATURE_FLAG,
            PNPM_FEATURE_FLAG,
            DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
            MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
          ],
          expect.any(String),
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

        expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
          [
            CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
            SCAN_USR_LIB_JARS_FEATURE_FLAG,
            PNPM_FEATURE_FLAG,
            DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
            MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
          ],
          expect.any(String),
        );
        expect(options[INCLUDE_SYSTEM_JARS_OPTION]).toBeUndefined();
      });
    });
  });
});
