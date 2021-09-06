import config from '../../../lib/config';
import { Options, ShowVulnPaths, TestOptions } from '../../../lib/types';

export function setDefaultTestOptions<CommandOptions>(
  options: Options & CommandOptions,
): Options & TestOptions & CommandOptions {
  const svpSupplied = (options['show-vulnerable-paths'] || '')
    .toString()
    .toLowerCase();

  delete options['show-vulnerable-paths'];
  return {
    ...options,
    // org fallback to config unless specified
    org: options.org || config.org,
    // making `show-vulnerable-paths` 'some' by default.
    showVulnPaths: showVulnPathsMapping[svpSupplied] || 'some',
  };
}

const showVulnPathsMapping: Record<string, ShowVulnPaths> = {
  false: 'none',
  none: 'none',
  true: 'some',
  some: 'some',
  all: 'all',
};
