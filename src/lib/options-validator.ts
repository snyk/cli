import { MonitorOptions, Options, TestOptions } from './types';
import * as config from './config';
import { SupportedPackageManagers } from './package-managers';
import * as reachableVulns from './reachable-vulns';

export async function validateOptions(
  options: (Options & TestOptions) | (Options & MonitorOptions),
  packageManager?: SupportedPackageManagers,
): Promise<void> {
  if (options.reachableVulns) {
    // Throwing error only in case when both packageManager and allProjects not defined
    if (!packageManager && !options.allProjects) {
      throw new Error('Could not determine package manager');
    }
    const org = options.org || config.org;
    await reachableVulns.validatePayload(org, options, packageManager);
  }
}
