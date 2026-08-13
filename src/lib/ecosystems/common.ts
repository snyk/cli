import { Ecosystem, PluginResponse, ScanResult } from './types';
import { hasFeatureFlagOrDefault } from '../feature-flags';
import { Options } from '../types';
import { CONTAINER_NEW_FACTS_FEATURE_FLAG } from '../../cli/commands/constants';

export function isUnmanagedEcosystem(ecosystem: Ecosystem): boolean {
  return ecosystem === 'cpp';
}

const FILTERED_FACT_TYPES = new Set([
  'history',
  'containerConfig',
  'pluginWarnings',
  'pluginVersion',
  'platform',
]);

const ADDITIONAL_FILTERED_FACT_TYPES_FOR_APP_PROJECTS = new Set([
  'ociDistributionMetadata',
  'imageNames',
]);

function shouldFilterFact(fact: any, isOsProject = true): boolean {
  // for both application and OS projects, filter out new facts
  if (FILTERED_FACT_TYPES.has(fact.type)) {
    return true;
  }
  // For application projects, also filter out 2 additional facts
  // OS project is always first, then subsequent scanResults are app projects
  if (
    !isOsProject &&
    ADDITIONAL_FILTERED_FACT_TYPES_FOR_APP_PROJECTS.has(fact.type)
  ) {
    return true;
  }
  return false;
}

export async function filterDockerFacts(
  pluginResponse: PluginResponse,
  ecosystem: Ecosystem,
  options: Options,
): Promise<PluginResponse> {
  // Only apply filtering for scan results from snyk-docker-plugin
  if (ecosystem !== 'docker') {
    return pluginResponse;
  }
  // Check feature flag - when false, we filter facts
  const includeAllFacts = await hasFeatureFlagOrDefault(
    CONTAINER_NEW_FACTS_FEATURE_FLAG,
    options,
    false,
  );

  if (includeAllFacts) {
    return pluginResponse;
  }
  // Feature disabled = filter out specific facts
  return {
    ...pluginResponse,
    scanResults: pluginResponse.scanResults.map(
      (scanResult: ScanResult, index: number) => ({
        ...scanResult,
        facts: scanResult.facts.filter(
          (fact) => !shouldFilterFact(fact, index === 0),
        ),
      }),
    ),
  };
}
