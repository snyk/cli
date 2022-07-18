import * as graphlib from '@snyk/graphlib';
import { CallGraph } from '@snyk/cli-interface/legacy/common';

import {
  REACHABLE_VULNS_SUPPORTED_PACKAGE_MANAGERS,
  SupportedPackageManagers,
} from './package-managers';
import { isFeatureFlagSupportedForOrg } from './feature-flags';
import {
  AuthFailedError,
  FeatureNotSupportedByPackageManagerError,
  UnsupportedFeatureFlagError,
} from './errors';
import { MonitorOptions, Options, TestOptions } from './types';
import { isMultiProjectScan } from './is-multi-project-scan';
import * as theme from './theme';

const featureFlag = 'reachableVulns';

export function serializeCallGraphWithMetrics(
  callGraph: CallGraph,
): {
  callGraph: any;
  nodeCount: number;
  edgeCount: number;
} {
  return {
    callGraph: graphlib.json.write(callGraph),
    nodeCount: callGraph.nodeCount(),
    edgeCount: callGraph.edgeCount(),
  };
}

export async function validatePayload(
  org: any,
  options: (Options & TestOptions) | (Options & MonitorOptions),
  packageManager?: SupportedPackageManagers,
): Promise<boolean> {
  if (
    packageManager &&
    !isMultiProjectScan(options) &&
    !REACHABLE_VULNS_SUPPORTED_PACKAGE_MANAGERS.includes(packageManager)
  ) {
    throw new FeatureNotSupportedByPackageManagerError(
      'Reachable vulns',
      packageManager,
      `For a list of supported package managers go to https://support.snyk.io/hc/en-us/articles/360010554837-Reachable-Vulnerabilities`,
    );
  }
  const reachableVulnsSupportedRes = await isFeatureFlagSupportedForOrg(
    featureFlag,
    org,
  );

  if (reachableVulnsSupportedRes.code === 401) {
    throw AuthFailedError(
      reachableVulnsSupportedRes.error,
      reachableVulnsSupportedRes.code,
    );
  }
  if (reachableVulnsSupportedRes.userMessage) {
    throw new UnsupportedFeatureFlagError(
      featureFlag,
      reachableVulnsSupportedRes.userMessage,
    );
  }
  return true;
}

export const reachableVulnsRemovalMessage = theme.color.status.warn(
  `${theme.icon.WARNING} Starting on August 15th 2022, the reachable flag (--reachable) will not be supported.We are currently developing new and improved capabilities for prioritizing vulnerabilities.Please follow https://updates.snyk.io for news and updates, and we are sorry for the temporary inconvenience.\n`,
);
