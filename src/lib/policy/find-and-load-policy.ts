import * as snykPolicyLib from 'snyk-policy';
import * as debugModule from 'debug';
import { PackageExpanded } from 'snyk-resolve-deps/dist/types';

import { pluckPolicies } from '.';
import { SupportedPackageManagers } from '../package-managers';
import { PolicyOptions } from '../types';
import * as analytics from '../analytics';

const debug = debugModule('snyk');

export async function findAndLoadPolicy(
  root: string,
  scanType: SupportedPackageManagers | 'docker' | 'iac' | 'cpp',
  options: PolicyOptions,
  pkg?: PackageExpanded,
  scannedProjectFolder?: string,
): Promise<snykPolicyLib.Policy | undefined> {
  const isDocker = scanType === 'docker';
  const isNodeProject = ['npm', 'yarn', 'pnpm'].includes(scanType);
  // monitor
  let policyLocations: string[] = [
    options['policy-path'] || scannedProjectFolder || root,
  ];
  if (isDocker) {
    policyLocations = policyLocations.filter((loc) => loc !== root);
  } else if (isNodeProject) {
    // TODO: pluckPolicies expects a package.json object to
    // find and apply policies in node_modules
    // TODO: fix these types, this is a hack and is not correct
    policyLocations = policyLocations.concat(
      pluckPolicies(pkg as unknown as PackageExpanded),
    );
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
