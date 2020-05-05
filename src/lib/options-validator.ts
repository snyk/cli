import { MonitorOptions, Options, TestOptions } from './types';
import * as config from './config';
import { SupportedPackageManagers } from './package-managers';
import * as reachableVulns from './reachable-vulns';

export async function validateOptions(
  options: (Options & TestOptions) | (Options & MonitorOptions),
  packageManager?: SupportedPackageManagers,
) {
  if (options.reachableVulns) {
    if (!packageManager) {
      throw new Error('Could not determine package manager');
    }
    const org = options.org || config.org;
    await reachableVulns.validatePayload(packageManager, org);
  }
}
