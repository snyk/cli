const fs = require('fs');
const path = require('path');
import { PatchInfo, Patch, VulnPatches, VulnIdAndPackageName } from './types';
const localPatches = require(`../../patches.json`);

export async function fetchPatches(
  vulnId: string,
  packageVersion: string,
): Promise<Patch[]> {
  const results = localPatches.filter((patchResponse) => {
    return (
      patchResponse.vulnerabilityId === vulnId &&
      patchResponse.libraryVersion === packageVersion
    );
  });

  const patchInfos: PatchInfo[] = [];
  results.forEach((match) => {
    match.patches.forEach((patch) => {
      patchInfos.push({
        patchableVersions: patch.version,
        urls: patch.urls,
      });
    }); // patchInfos is an array and each element has a .url which is also an array
  });
  const patchDiffs: Patch[] = [];
  for (const p of patchInfos) {
    const diffs: string[] = [];
    for (const url of p.urls) {
      diffs.push(
        fs.readFileSync(
          path.resolve(__dirname, '../../patches/' + url),
          'utf8',
        ),
      );
    }

    patchDiffs.push({
      patchableVersions: p.patchableVersions,
      patchDiffs: diffs,
    });
  }
  return patchDiffs;
}

// Note that, for any given package@version, there might be N `VulnPatches`, each of which can have multiple `Patch`es, each of which can have multiple actual diffs.
// This is because the backend data model for a vuln is such that a vuln can have N patches (logical patches) and each patch can have N urls (corresponding to physical patches).
export async function getAllPatches(
  vulnIdAndPackageNames: VulnIdAndPackageName[],
  packageNameToVersionsMap: Map<string, string[]>,
): Promise<Map<string, VulnPatches[]>> {
  const packageAtVersionsToPatches = new Map<string, VulnPatches[]>();
  for (const vpn of vulnIdAndPackageNames) {
    const packageVersions = packageNameToVersionsMap.get(vpn.packageName);
    if (packageVersions) {
      for (const packageVersion of packageVersions) {
        const packageNameAtVersion = `${vpn.packageName}@${packageVersion}`;
        const patches = await fetchPatches(vpn.vulnId, packageVersion);
        const vulnIdAndDiffs: VulnPatches = {
          vulnId: vpn.vulnId,
          patches,
        };
        if (packageAtVersionsToPatches.has(packageNameAtVersion)) {
          packageAtVersionsToPatches
            .get(packageNameAtVersion)
            ?.push(vulnIdAndDiffs); // TODO what if this is a duplicate?
        } else {
          packageAtVersionsToPatches.set(packageNameAtVersion, [
            vulnIdAndDiffs,
          ]);
        }
      }
    }
  }
  return packageAtVersionsToPatches;
}
