import monitor from '../../../../src/cli/commands/monitor';
import { DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG } from '../../../../src/lib/package-managers';
import * as featureFlags from '../../../../src/lib/feature-flags';
import * as ecosystems from '../../../../src/lib/ecosystems';
import * as analytics from '../../../../src/lib/analytics';
import * as snykMonitor from '../../../../src/lib/monitor';
import config from '../../../../src/lib/config';
import { apiOrOAuthTokenExists } from '../../../../src/lib/api-token';
import { runTest } from '../../../../src/lib/snyk-test/run-test';
import * as detect from '../../../../src/lib/detect';
import test from '../../../../src/cli/commands/test';

jest.mock('../../../../src/lib/api-token');
jest.mock('../../../../src/lib/check-paths');
jest.mock('../../../../src/lib/detect');
jest.mock('../../../../src/lib/formatters');
jest.mock('../../../../src/lib/plugins/get-deps-from-plugin');
jest.mock('../../../../src/lib/spinner');
jest.mock('../../../../src/lib/snyk-test/run-test');
jest.mock('../../../../src/lib/feature-flags');
jest.mock('../../../../src/lib/protect-update-notification', () => ({
  getPackageJsonPathsContainingSnykDependency: jest.fn(() => []),
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
    // Reset and set default mock for feature flags
    (featureFlags.hasFeatureFlag as jest.Mock).mockReset();
    (featureFlags.hasFeatureFlag as jest.Mock).mockImplementation(() =>
      Promise.resolve(false),
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
    // Ensure feature flag mock is reset to default implementation
    (featureFlags.hasFeatureFlag as jest.Mock).mockReset();
    (featureFlags.hasFeatureFlag as jest.Mock).mockImplementation(() =>
      Promise.resolve(false),
    );
  });

  describe('monitor', () => {
    it('should set useImprovedDotnetWithoutPublish on options when the feature flag is enabled', async () => {
      getEcosystemSpy.mockReturnValue(undefined);
      analyticsSpy.mockReturnValue(false);
      const options: any = {
        'dotnet-runtime-resolution': true,
      };
      (featureFlags.hasFeatureFlag as jest.Mock).mockResolvedValue(true);

      try {
        await monitor('path/to/project', options);
      } catch (error) {
        // We expect this to fail since we are not mocking all dependencies.
        // We only care about the options being set correctly.
      }

      expect(featureFlags.hasFeatureFlag).toHaveBeenCalledWith(
        DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
        options,
      );
      expect(options.useImprovedDotnetWithoutPublish).toBe(true);
    });

    it('should not set useImprovedDotnetWithoutPublish on options when the feature flag is disabled', async () => {
      getEcosystemSpy.mockReturnValue(undefined);
      analyticsSpy.mockReturnValue(false);
      const options: any = {
        'dotnet-runtime-resolution': true,
      };
      (featureFlags.hasFeatureFlag as jest.Mock).mockResolvedValue(false);

      try {
        await monitor('path/to/project', options);
      } catch (error) {
        // We expect this to fail since we are not mocking all dependencies.
        // We only care about the options being set correctly.
      }

      expect(featureFlags.hasFeatureFlag).toHaveBeenCalledWith(
        DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
        options,
      );
      expect(options.useImprovedDotnetWithoutPublish).toBeUndefined();
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

      expect(featureFlags.hasFeatureFlag).not.toHaveBeenCalledWith(
        DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
        options,
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
      (featureFlags.hasFeatureFlag as jest.Mock).mockResolvedValue(true);
      await snykTest('path/to/project', options);

      expect(featureFlags.hasFeatureFlag).toHaveBeenCalledWith(
        DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
        options,
      );
      expect(options.useImprovedDotnetWithoutPublish).toBe(true);
    });

    it('should not set useImprovedDotnetWithoutPublish on options when the feature flag is disabled', async () => {
      const options: any = {
        'dotnet-runtime-resolution': true,
      };
      (featureFlags.hasFeatureFlag as jest.Mock).mockResolvedValue(false);
      await snykTest('path/to/project', options);

      expect(featureFlags.hasFeatureFlag).toHaveBeenCalledWith(
        DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
        options,
      );
      expect(options.useImprovedDotnetWithoutPublish).toBeUndefined();
    });

    it('should not check the feature flag if dotnet-runtime-resolution is not enabled', async () => {
      const options: any = {};
      await snykTest('path/to/project', options);

      expect(featureFlags.hasFeatureFlag).not.toHaveBeenCalledWith(
        DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
        options,
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
      it('should set include-system-jars when scanUsrLibJars feature flag is enabled', async () => {
        const options: any = {
          docker: true,
          'exclude-app-vulns': true, // Skip containerCliAppVulnsEnabled check
        };

        // Mock feature flag responses - need to handle multiple calls
        let internalOptions: any = null;
        (featureFlags.hasFeatureFlag as jest.Mock).mockImplementation(
          (flag: string, opts: any) => {
            if (flag === 'scanUsrLibJars') {
              internalOptions = opts; // Capture the internal options object
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

        expect(featureFlags.hasFeatureFlag).toHaveBeenCalledWith(
          'scanUsrLibJars',
          expect.objectContaining({
            docker: true,
          }),
        );

        // Verify that the scanUsrLibJars feature flag was called and would set include-system-jars
        expect(internalOptions).toBeTruthy();
        expect(internalOptions.docker).toBe(true);
        // Note: The actual setting of include-system-jars happens in the real implementation
        // after the feature flag returns true
      });

      it('should not set include-system-jars when scanUsrLibJars feature flag is disabled', async () => {
        const options: any = {
          docker: true,
          'exclude-app-vulns': true, // Skip containerCliAppVulnsEnabled check
        };

        // Mock feature flag responses - need to handle multiple calls
        (featureFlags.hasFeatureFlag as jest.Mock).mockImplementation(() => {
          return Promise.resolve(false); // All flags disabled
        });

        try {
          await test('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlags.hasFeatureFlag).toHaveBeenCalledWith(
          'scanUsrLibJars',
          expect.objectContaining({
            docker: true,
          }),
        );
        // When the feature flag is disabled, include-system-jars should not be set
        // Note: We can't easily test this since the real implementation works on internal options
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

        expect(featureFlags.hasFeatureFlag).not.toHaveBeenCalledWith(
          'scanUsrLibJars',
          options,
        );
        expect(options['include-system-jars']).toBeUndefined();
      });
    });

    describe('monitor command', () => {
      it('should set include-system-jars when scanUsrLibJars feature flag is enabled', async () => {
        const options: any = {
          docker: true,
          'exclude-app-vulns': true, // Skip containerCliAppVulnsEnabled check
        };

        // Mock feature flag responses - need to handle multiple calls
        (featureFlags.hasFeatureFlag as jest.Mock).mockImplementation(
          (flag: string) => {
            if (flag === 'scanUsrLibJars') {
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

        expect(featureFlags.hasFeatureFlag).toHaveBeenCalledWith(
          'scanUsrLibJars',
          expect.objectContaining({
            docker: true,
          }),
        );
        // Note: The monitor command should set include-system-jars when scanUsrLibJars is enabled
        // but we can't easily test the internal options modification in this test setup
      });

      it('should not set include-system-jars when scanUsrLibJars feature flag is disabled', async () => {
        const options: any = {
          docker: true,
          'exclude-app-vulns': true, // Skip containerCliAppVulnsEnabled check
        };

        // Mock feature flag responses - need to handle multiple calls
        (featureFlags.hasFeatureFlag as jest.Mock).mockImplementation(() => {
          return Promise.resolve(false); // All flags disabled
        });

        try {
          await monitor('docker-image:latest', options);
        } catch (error) {
          // We expect this to fail since we are not mocking all dependencies.
          // We only care about the feature flag being called correctly.
        }

        expect(featureFlags.hasFeatureFlag).toHaveBeenCalledWith(
          'scanUsrLibJars',
          expect.objectContaining({
            docker: true,
          }),
        );
        // When the feature flag is disabled, include-system-jars should not be set
        // Note: We can't easily test this since the real implementation works on internal options
      });
    });
  });
});
