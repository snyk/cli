import { legacyPlugin as pluginApi } from '@snyk/cli-interface';

export function getSubProjectCount(
  inspectResult: pluginApi.InspectResult,
): number | undefined {
  if (
    inspectResult.plugin.meta &&
    inspectResult.plugin.meta.allSubProjectNames &&
    inspectResult.plugin.meta.allSubProjectNames.length > 1
  ) {
    return inspectResult.plugin.meta.allSubProjectNames.length;
  }

  return undefined;
}
