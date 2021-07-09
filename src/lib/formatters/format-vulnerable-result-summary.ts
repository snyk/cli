import { Options, TestOptions } from '../../lib/types';

export function summariseVulnerableResults(
  vulnerableResults,
  options: Options & TestOptions,
): string {
  const vulnsLength = vulnerableResults.length;
  if (vulnsLength) {
    if (options.showVulnPaths) {
      return `, ${vulnsLength} contained ${
        options.iac ? 'issues' : 'vulnerable paths'
      }.`;
    }
    return `, ${vulnsLength} had issues.`;
  }

  if (options.showVulnPaths) {
    return ', no vulnerable paths were found.';
  }

  return ', no issues were found.';
}
