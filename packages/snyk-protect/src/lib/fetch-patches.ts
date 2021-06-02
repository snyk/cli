import { PatchInfo, Patch, VulnPatches, VulnIdAndPackageName } from './types';
import { request } from './http';
import { getApiBaseUrl } from './snyk-api';

export async function fetchPatches(
  vulnId: string,
  packageName: string,
  packageVersion: string,
): Promise<Patch[]> {
  const apiBaseUrl = getApiBaseUrl();
  const apiUrl = `${apiBaseUrl}/v1/patches/${vulnId}?packageVersion=${packageVersion}`;

  const { res, body } = await request(apiUrl);
  if (res.statusCode !== 200 && res.statusCode !== 201) {
    throw new Error(JSON.parse(body).error);
  }

  const jsonRes = JSON.parse(body);
  if (jsonRes.packageName !== packageName) {
    throw new Error('packageName in response not equal to packageName');
  }
  const patches = jsonRes.patches;
  const patchInfos: PatchInfo[] = patches; // patchInfos is an array and each element has a .url which is also an array

  const patchDiffs: Patch[] = [];
  for (const p of patchInfos) {
    const diffs: string[] = [];
    for (const url of p.urls) {
      const { body: diff } = await request(url);
      diffs.push(diff);
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
        const patches = await fetchPatches(
          vpn.vulnId,
          vpn.packageName,
          packageVersion,
        );
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
