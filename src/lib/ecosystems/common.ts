import { Ecosystem, PluginResponse, ScanResult } from './types';
import { hasFeatureFlagOrDefault } from '../feature-flags';
import { Options } from '../types';
import { DOCKER_FACTS_FILTERING_FEATURE_FLAG } from '../../cli/commands/constants';

export function isUnmanagedEcosystem(ecosystem: Ecosystem): boolean {
  return ecosystem === 'cpp';
}

const FILTERED_FACT_TYPES = new Set([
  'history',
  'containerConfig',
  'pluginWarnings',
  'pluginVersion',
  'platform'
]);

const ADDITIONAL_FILTERED_FACT_TYPES_FOR_APP_PROJECTS = new Set([
  'ociDistributionMetadata',
  'imageNames'
]);

function shouldFilterFact(fact: any, isFirstIndex: boolean = true): boolean {
  if (FILTERED_FACT_TYPES.has(fact.type)) {
    return true;
  }
  
  // For non-first index (application projects), also filter additional fact types
  if (!isFirstIndex && ADDITIONAL_FILTERED_FACT_TYPES_FOR_APP_PROJECTS.has(fact.type)) {
    return true;
  }
  
  return false;
}

export async function filterDockerFacts(
  pluginResponse: PluginResponse,
  ecosystem: Ecosystem,
  options: Options,
): Promise<PluginResponse> {
  // Only apply filtering to docker plugin
  if (ecosystem !== 'docker') {
    return pluginResponse;
  }

  // Check feature flag - when disabled (false), we filter facts
  const includeAllFacts = await hasFeatureFlagOrDefault(
    DOCKER_FACTS_FILTERING_FEATURE_FLAG,
    options,
    false, // default: false = filter facts
  );

  if (includeAllFacts) {
    return pluginResponse; // Feature enabled = include all facts
  }

  // Feature disabled = filter out specific facts
  return {
    ...pluginResponse,
    scanResults: pluginResponse.scanResults.map((scanResult: ScanResult, index: number) => ({
      ...scanResult,
      facts: scanResult.facts.filter((fact) => !shouldFilterFact(fact, index === 0)),
    })),
  };
}
