import { filterDockerFacts } from '../../../src/lib/ecosystems/common';
import {
  PluginResponse,
  ScanResult,
  Ecosystem,
} from '../../../src/lib/ecosystems/types';
import { Options } from '../../../src/lib/types';
import * as featureFlags from '../../../src/lib/feature-flags';
import { CONTAINER_NEW_FACTS_FEATURE_FLAG } from '../../../src/cli/commands/constants';

jest.mock('../../../src/lib/feature-flags');

describe('ecosystems/common', () => {
  describe('filterDockerFacts', () => {
    let mockPluginResponse: PluginResponse;
    let mockOptions: Options;

    beforeEach(() => {
      mockPluginResponse = {
        scanResults: [
          {
            identity: { type: 'deb' },
            facts: [
              { type: 'depGraph', data: {} },
              { type: 'history', data: {} },
              { type: 'containerConfig', data: {} },
              { type: 'pluginWarnings', data: [] },
              { type: 'pluginVersion', data: '9.1.0' },
              { type: 'dockerfileAnalysis', data: {} },
              { type: 'ociDistributionMetadata', data: {} },
              { type: 'imageNames', data: [] },
              { type: 'platform', data: {} },
            ],
            target: { image: 'test:latest' },
          },
        ] as ScanResult[],
      };

      mockOptions = {
        path: 'test:latest',
        org: 'test-org',
      } as Options;

      jest.clearAllMocks();
    });

    it('should not filter facts for non-docker ecosystems', async () => {
      const ecosystem: Ecosystem = 'cpp';

      const result = await filterDockerFacts(
        mockPluginResponse,
        ecosystem,
        mockOptions,
      );

      expect(result).toBe(mockPluginResponse);
      expect(featureFlags.hasFeatureFlagOrDefault).not.toHaveBeenCalled();
    });

    it('should not filter facts when feature flag is enabled (true)', async () => {
      const ecosystem: Ecosystem = 'docker';
      (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(
        true,
      );

      const result = await filterDockerFacts(
        mockPluginResponse,
        ecosystem,
        mockOptions,
      );

      expect(featureFlags.hasFeatureFlagOrDefault).toHaveBeenCalledWith(
        CONTAINER_NEW_FACTS_FEATURE_FLAG,
        mockOptions,
        false,
      );
      expect(result).toEqual(mockPluginResponse);
      expect(result.scanResults[0].facts).toHaveLength(9);
      // Verify other parts of pluginResponse remain unchanged
      expect(result.scanResults[0].identity).toEqual(
        mockPluginResponse.scanResults[0].identity,
      );
      expect(result.scanResults[0].target).toEqual(
        mockPluginResponse.scanResults[0].target,
      );
    });

    it('should filter OS project facts (first index) when feature flag is disabled', async () => {
      const ecosystem: Ecosystem = 'docker';
      (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(
        false,
      );

      const result = await filterDockerFacts(
        mockPluginResponse,
        ecosystem,
        mockOptions,
      );

      expect(featureFlags.hasFeatureFlagOrDefault).toHaveBeenCalledWith(
        CONTAINER_NEW_FACTS_FEATURE_FLAG,
        mockOptions,
        false,
      );
      // OS project (first index) should filter base facts but keep ociDistributionMetadata and imageNames
      expect(result.scanResults[0].facts).toHaveLength(4);
      expect(result.scanResults[0].facts).toEqual([
        { type: 'depGraph', data: {} },
        { type: 'dockerfileAnalysis', data: {} },
        { type: 'ociDistributionMetadata', data: {} },
        { type: 'imageNames', data: [] },
      ]);
      // Verify other parts of pluginResponse remain unchanged
      expect(result.scanResults[0].identity).toEqual(
        mockPluginResponse.scanResults[0].identity,
      );
      expect(result.scanResults[0].target).toEqual(
        mockPluginResponse.scanResults[0].target,
      );
    });

    it('should filter application project facts (non-first index) with additional filtering', async () => {
      const ecosystem: Ecosystem = 'docker';
      (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(
        false,
      );

      // Add a second scan result (application project)
      mockPluginResponse.scanResults.push({
        identity: { type: 'npm' },
        facts: [
          { type: 'depGraph', data: {} },
          { type: 'history', data: {} },
          { type: 'containerConfig', data: {} },
          { type: 'pluginWarnings', data: [] },
          { type: 'pluginVersion', data: '9.1.0' },
          { type: 'dockerfileAnalysis', data: {} },
          { type: 'ociDistributionMetadata', data: {} },
          { type: 'imageNames', data: [] },
          { type: 'platform', data: {} },
        ],
        target: { image: 'test:latest' },
      } as ScanResult);

      const result = await filterDockerFacts(
        mockPluginResponse,
        ecosystem,
        mockOptions,
      );

      // OS project (first index) should keep ociDistributionMetadata and imageNames
      const osFactTypes = result.scanResults[0].facts.map((fact) => fact.type);
      expect(osFactTypes).toContain('ociDistributionMetadata');
      expect(osFactTypes).toContain('imageNames');
      expect(osFactTypes).not.toContain('history');
      expect(osFactTypes).not.toContain('containerConfig');
      expect(osFactTypes).not.toContain('pluginWarnings');
      expect(osFactTypes).not.toContain('pluginVersion');
      expect(osFactTypes).not.toContain('platform');

      // Application project (second index) should filter out additional facts
      const appFactTypes = result.scanResults[1].facts.map((fact) => fact.type);
      expect(appFactTypes).not.toContain('ociDistributionMetadata');
      expect(appFactTypes).not.toContain('imageNames');
      expect(appFactTypes).not.toContain('history');
      expect(appFactTypes).not.toContain('containerConfig');
      expect(appFactTypes).not.toContain('pluginWarnings');
      expect(appFactTypes).not.toContain('pluginVersion');
      expect(appFactTypes).not.toContain('platform');

      // Both should still contain other fact types
      expect(osFactTypes).toContain('depGraph');
      expect(osFactTypes).toContain('dockerfileAnalysis');
      expect(appFactTypes).toContain('depGraph');
      expect(appFactTypes).toContain('dockerfileAnalysis');

      // Verify other parts of pluginResponse remain unchanged
      expect(result.scanResults[0].identity).toEqual(
        mockPluginResponse.scanResults[0].identity,
      );
      expect(result.scanResults[0].target).toEqual(
        mockPluginResponse.scanResults[0].target,
      );
      expect(result.scanResults[1].identity).toEqual(
        mockPluginResponse.scanResults[1].identity,
      );
      expect(result.scanResults[1].target).toEqual(
        mockPluginResponse.scanResults[1].target,
      );
    });

    it('should preserve other scanResult properties when filtering', async () => {
      const ecosystem: Ecosystem = 'docker';
      (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(
        false,
      );

      const result = await filterDockerFacts(
        mockPluginResponse,
        ecosystem,
        mockOptions,
      );

      expect(result.scanResults[0].identity).toEqual(
        mockPluginResponse.scanResults[0].identity,
      );
      expect(result.scanResults[0].target).toEqual(
        mockPluginResponse.scanResults[0].target,
      );
      // Verify the overall structure is preserved
      expect(result.scanResults).toHaveLength(
        mockPluginResponse.scanResults.length,
      );
      expect(Object.keys(result)).toEqual(Object.keys(mockPluginResponse));
    });

    it('should handle multiple scan results with different filtering per index', async () => {
      const ecosystem: Ecosystem = 'docker';
      (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(
        false,
      );

      mockPluginResponse.scanResults.push({
        identity: { type: 'rpm' },
        facts: [
          { type: 'depGraph', data: {} },
          { type: 'history', data: {} },
          { type: 'pluginVersion', data: '9.1.0' },
          { type: 'ociDistributionMetadata', data: {} },
          { type: 'imageNames', data: [] },
        ],
        target: { image: 'test2:latest' },
      } as ScanResult);

      const result = await filterDockerFacts(
        mockPluginResponse,
        ecosystem,
        mockOptions,
      );

      expect(result.scanResults).toHaveLength(2);

      // OS project (first index) should have 4 facts (keeps ociDistributionMetadata and imageNames)
      expect(result.scanResults[0].facts).toHaveLength(4);
      const osFactTypes = result.scanResults[0].facts.map((fact) => fact.type);
      expect(osFactTypes).toContain('ociDistributionMetadata');
      expect(osFactTypes).toContain('imageNames');

      // Application project (second index) should have 1 fact (filters out ociDistributionMetadata and imageNames)
      expect(result.scanResults[1].facts).toHaveLength(1);
      expect(result.scanResults[1].facts[0].type).toBe('depGraph');
      const appFactTypes = result.scanResults[1].facts.map((fact) => fact.type);
      expect(appFactTypes).not.toContain('ociDistributionMetadata');
      expect(appFactTypes).not.toContain('imageNames');

      // Verify other parts of pluginResponse remain unchanged
      expect(result.scanResults[0].identity).toEqual(
        mockPluginResponse.scanResults[0].identity,
      );
      expect(result.scanResults[0].target).toEqual(
        mockPluginResponse.scanResults[0].target,
      );
      expect(result.scanResults[1].identity).toEqual(
        mockPluginResponse.scanResults[1].identity,
      );
      expect(result.scanResults[1].target).toEqual(
        mockPluginResponse.scanResults[1].target,
      );
    });

    it('should handle scan results with no filterable facts', async () => {
      const ecosystem: Ecosystem = 'docker';
      (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(
        false,
      );

      mockPluginResponse.scanResults[0].facts = [
        { type: 'depGraph', data: {} },
        { type: 'dockerfileAnalysis', data: {} },
      ];

      const result = await filterDockerFacts(
        mockPluginResponse,
        ecosystem,
        mockOptions,
      );

      expect(result.scanResults[0].facts).toHaveLength(2);
      expect(result.scanResults[0].facts).toEqual(
        mockPluginResponse.scanResults[0].facts,
      );
      // Verify other parts of pluginResponse remain unchanged
      expect(result.scanResults[0].identity).toEqual(
        mockPluginResponse.scanResults[0].identity,
      );
      expect(result.scanResults[0].target).toEqual(
        mockPluginResponse.scanResults[0].target,
      );
      expect(Object.keys(result)).toEqual(Object.keys(mockPluginResponse));
    });

    it('should demonstrate different filtering behavior between OS and application projects', async () => {
      const ecosystem: Ecosystem = 'docker';
      (featureFlags.hasFeatureFlagOrDefault as jest.Mock).mockResolvedValue(
        false,
      );

      // Create a multi-project scenario: OS project + 2 application projects
      mockPluginResponse.scanResults = [
        // OS project (index 0)
        {
          identity: { type: 'deb' },
          facts: [
            { type: 'depGraph', data: {} },
            { type: 'history', data: {} },
            { type: 'ociDistributionMetadata', data: {} },
            { type: 'imageNames', data: [] },
            { type: 'pluginWarnings', data: [] },
          ],
          target: { image: 'test:latest' },
        },
        // Application project 1 (index 1)
        {
          identity: { type: 'npm' },
          facts: [
            { type: 'depGraph', data: {} },
            { type: 'history', data: {} },
            { type: 'ociDistributionMetadata', data: {} },
            { type: 'imageNames', data: [] },
            { type: 'pluginWarnings', data: [] },
          ],
          target: { image: 'test:latest' },
        },
        // Application project 2 (index 2)
        {
          identity: { type: 'maven' },
          facts: [
            { type: 'depGraph', data: {} },
            { type: 'containerConfig', data: {} },
            { type: 'ociDistributionMetadata', data: {} },
            { type: 'imageNames', data: [] },
            { type: 'platform', data: {} },
          ],
          target: { image: 'test:latest' },
        },
      ] as ScanResult[];

      const result = await filterDockerFacts(
        mockPluginResponse,
        ecosystem,
        mockOptions,
      );

      // OS project (index 0) keeps ociDistributionMetadata and imageNames
      const osFactTypes = result.scanResults[0].facts.map((fact) => fact.type);
      expect(osFactTypes).toContain('depGraph');
      expect(osFactTypes).toContain('ociDistributionMetadata');
      expect(osFactTypes).toContain('imageNames');
      expect(osFactTypes).not.toContain('history');
      expect(osFactTypes).not.toContain('pluginWarnings');
      expect(result.scanResults[0].facts).toHaveLength(3);

      // Application project 1 (index 1) filters out ociDistributionMetadata and imageNames
      const app1FactTypes = result.scanResults[1].facts.map(
        (fact) => fact.type,
      );
      expect(app1FactTypes).toContain('depGraph');
      expect(app1FactTypes).not.toContain('ociDistributionMetadata');
      expect(app1FactTypes).not.toContain('imageNames');
      expect(app1FactTypes).not.toContain('history');
      expect(app1FactTypes).not.toContain('pluginWarnings');
      expect(result.scanResults[1].facts).toHaveLength(1);

      // Application project 2 (index 2) filters out ociDistributionMetadata and imageNames
      const app2FactTypes = result.scanResults[2].facts.map(
        (fact) => fact.type,
      );
      expect(app2FactTypes).toContain('depGraph');
      expect(app2FactTypes).not.toContain('ociDistributionMetadata');
      expect(app2FactTypes).not.toContain('imageNames');
      expect(app2FactTypes).not.toContain('containerConfig');
      expect(app2FactTypes).not.toContain('platform');
      expect(result.scanResults[2].facts).toHaveLength(1);

      // Verify all other parts of pluginResponse remain unchanged
      result.scanResults.forEach((scanResult, index) => {
        expect(scanResult.identity).toEqual(
          mockPluginResponse.scanResults[index].identity,
        );
        expect(scanResult.target).toEqual(
          mockPluginResponse.scanResults[index].target,
        );
      });
      expect(Object.keys(result)).toEqual(Object.keys(mockPluginResponse));
    });
  });
});
