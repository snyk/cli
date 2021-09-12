import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { find } from '../find-files';
import { AUTO_DETECTABLE_FILES } from '../detect';
import { Options } from '../types';

export async function getExtraProjectCount(
  root: string,
  options: Options,
  inspectResult: pluginApi.InspectResult,
): Promise<number | undefined> {
  if (options.docker || options.unmanaged) {
    return undefined;
  }
  if (
    inspectResult.plugin.meta &&
    inspectResult.plugin.meta.allSubProjectNames &&
    inspectResult.plugin.meta.allSubProjectNames.length > 0
  ) {
    return inspectResult.plugin.meta.allSubProjectNames.length;
  }
  try {
    const { files: extraTargetFiles } = await find(
      root,
      [],
      AUTO_DETECTABLE_FILES,
    );
    const foundProjectsCount =
      extraTargetFiles.length > 1 ? extraTargetFiles.length - 1 : undefined;
    return foundProjectsCount;
  } catch (e) {
    return undefined;
  }
}
