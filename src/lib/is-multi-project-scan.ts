import { Options, TestOptions, MonitorOptions, PolicyOptions } from './types';

export function isMultiProjectScan(
  options: Partial<Options & TestOptions & MonitorOptions & PolicyOptions>,
): boolean {
  return !!(options.allProjects || options.yarnWorkspaces);
}
