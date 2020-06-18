import { pluckPolicies } from '.';
import { SupportedPackageManagers } from '../package-managers';
import snyk = require('..');

export async function findAndLoadPolicy(
  root,
  policyPath,
  scanType: SupportedPackageManagers | 'docker',
  options,
  pkg?: any,
): Promise<string> {
  const isDocker = scanType === 'docker';
  const isNodeProject = ['npm', 'yarn'].indexOf(scanType) > -1;
  // monitor
  let policyLocations: string[] = [policyPath || root];
  if (isDocker) {
    policyLocations = policyLocations.filter((loc) => {
      return loc !== root;
    });
  } else if (isNodeProject) {
    // TODO: pluckPolicies expects a package.json object see policies in node_modules
    policyLocations = policyLocations.concat(pluckPolicies(pkg as any));
  }
  let policy;
  if (policyLocations.length > 0) {
    try {
      policy = await snyk.policy.load(policyLocations, options);
    } catch (err) {
      // note: inline catch, to handle error from .load
      // if the .snyk file wasn't found, it is fine
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }
  return policy;
}
