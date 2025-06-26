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

jest.mock('../../../../src/lib/api-token');
jest.mock('../../../../src/lib/check-paths');
jest.mock('../../../../src/lib/detect');
jest.mock('../../../../src/lib/formatters');
jest.mock('../../../../src/lib/plugins/get-deps-from-plugin');
jest.mock('../../../../src/lib/spinner');
jest.mock('../../../../src/lib/snyk-test/run-test');
jest.mock('../../../../src/lib/feature-flags');

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
    (featureFlags.hasFeatureFlag as jest.Mock).mockResolvedValue(false);

    // mock config values
    Object.defineProperty(config, 'PROJECT_NAME', {
      value: 'default-project-name',
    });
  });

  afterEach(() => {
    getEcosystemSpy.mockRestore();
    analyticsSpy.mockRestore();
    snykMonitorSpy.mockRestore();
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
});
