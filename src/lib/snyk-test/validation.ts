import { Options, TestOptions } from '../types';
import * as config from '../config';
import { SupportedPackageManagers } from '../package-managers';
import * as reachableVulns from '../reachable-vulns';

export async function validateOptions(options: Options & TestOptions) {
  if (options.reachableVulns) {
    const pkgManager = options.packageManager as SupportedPackageManagers;
    const org = options.org || config.org;
    await reachableVulns.validatePayload(pkgManager, org);
  }
}
