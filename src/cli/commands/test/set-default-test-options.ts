import config from '../../../lib/config';
import { Options, ShowVulnPaths, TestOptions } from '../../../lib/types';

/**
 * Default path cap for `snyk container test` JSON when the user has not
 * asked for every path. Matches the human-readable "some" display (3 paths).
 * Without a cap, high-fan-in application graphs (e.g. NuGet deps.json) expand
 * one full JSON issue copy per dependency path and can reach hundreds of MB.
 */
export const DEFAULT_DOCKER_MAX_VULN_PATHS = 3;

export function setDefaultTestOptions<CommandOptions>(
  options: Options & CommandOptions,
): Options & TestOptions & CommandOptions {
  const svpSupplied = (options['show-vulnerable-paths'] || '')
    .toString()
    .toLowerCase();

  delete options['show-vulnerable-paths'];
  const showVulnPaths = showVulnPathsMapping[svpSupplied] || 'some';
  const maxVulnPaths = resolveMaxVulnPaths(options, showVulnPaths);
  return {
    ...options,
    // org fallback to config unless specified
    org: options.org || config.org,
    // making `show-vulnerable-paths` 'some' by default.
    showVulnPaths,
    maxVulnPaths,
  };
}

function resolveMaxVulnPaths(
  options: Options,
  showVulnPaths: ShowVulnPaths,
): number | undefined {
  // --show-vulnerable-paths=all means every path; ignore any default (and an
  // explicit --max-vulnerable-paths) so JSON matches that request.
  if (showVulnPaths === 'all') {
    return undefined;
  }

  if (options['max-vulnerable-paths'] !== undefined) {
    return options['max-vulnerable-paths'];
  }

  if (options.docker) {
    return DEFAULT_DOCKER_MAX_VULN_PATHS;
  }

  return undefined;
}

const showVulnPathsMapping: Record<string, ShowVulnPaths> = {
  false: 'none',
  none: 'none',
  true: 'some',
  some: 'some',
  all: 'all',
};
