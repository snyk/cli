import * as graphlib from 'graphlib';
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
  packageManager: SupportedPackageManagers,
  org: any,
): Promise<boolean> {
  if (!REACHABLE_VULNS_SUPPORTED_PACKAGE_MANAGERS.includes(packageManager)) {
    throw new FeatureNotSupportedByPackageManagerError(
      'Reachable vulns',
      packageManager,
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
