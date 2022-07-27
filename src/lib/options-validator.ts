import { MonitorOptions, Options, TestOptions } from './types';
import config from './config';
import { SupportedPackageManagers } from './package-managers';
import * as reachableVulns from './reachable-vulns';
import { isMultiProjectScan } from './is-multi-project-scan';
import { FeatureNotSupportedByPackageManagerError } from './errors';
import * as alerts from './alerts';

export async function validateOptions(
  options: (Options & TestOptions) | (Options & MonitorOptions),
  packageManager?: SupportedPackageManagers,
): Promise<void> {
  if (options.reachableVulns) {
    alerts.registerAlerts([
      {
        type: 'warning',
        name: 'reachable deprecation',
        msg: reachableVulns.reachableVulnsRemovalMessage,
      },
    ]);
  }

  if (options.reachableVulns) {
    // Throwing error only in case when both packageManager and allProjects not defined
    if (!packageManager && !isMultiProjectScan(options)) {
      throw new Error('Could not determine package manager');
    }
    const org = options.org || config.org;

    try {
      await reachableVulns.validatePayload(org, options, packageManager);
    } catch (err) {
      if (
        err instanceof FeatureNotSupportedByPackageManagerError &&
        err.feature === 'Reachable vulns' &&
        err.userMessage
      ) {
        alerts.registerAlerts([
          {
            type: 'error',
            name: 'pkgman-not-supported',
            msg: err.userMessage,
          },
        ]);
      } else {
        throw err;
      }
    }
  }
}
