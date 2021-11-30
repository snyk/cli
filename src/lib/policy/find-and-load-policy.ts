import snykPolicyLib from 'snyk-policy';
import debugModule from 'debug';
import { PackageExpanded } from 'snyk-resolve-deps';

import { pluckPolicies } from '.';
import { SupportedPackageManagers } from '../package-managers';
import { PackageJson, PolicyOptions } from '../types';
import * as analytics from '../analytics';

const debug = debugModule('snyk');

export async function findAndLoadPolicy(
  root: string,
  scanType: SupportedPackageManagers | 'docker' | 'iac',
  options: PolicyOptions,
  pkg?: PackageExpanded,
  scannedProjectFolder?: string,
): Promise<Policy | undefined> {
  const isDocker = scanType === 'docker';
  const isNodeProject = ['npm', 'yarn'].includes(scanType);
  // monitor
  let policyLocations: string[] = [
    options['policy-path'] || scannedProjectFolder || root,
  ];
  if (isDocker) {
    policyLocations = policyLocations.filter((loc) => loc !== root);
  } else if (isNodeProject) {
    // TODO: pluckPolicies expects a package.json object to
    // find and apply policies in node_modules
    policyLocations = policyLocations.concat(pluckPolicies(pkg as PackageJson));
  }

  debug('Potential policy locations found:', policyLocations);
  analytics.add('policies', policyLocations.length);
  analytics.add('policyLocations', policyLocations);

  if (policyLocations.length === 0) {
    return;
  }
  let policy;
  try {
    policy = await snykPolicyLib.load(policyLocations, options);
  } catch (err) {
    // note: inline catch, to handle error from .load
    // if the .snyk file wasn't found, it is fine
    if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
      throw err;
    }
  }
  return policy;
}

export interface Policy {
  filter(vulns: any, root?: string, matchStrategy?: string): any;
}
