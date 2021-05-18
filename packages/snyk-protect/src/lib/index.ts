import * as fs from 'fs';
import * as path from 'path';
import { extractPatchMetadata } from './snyk-file';
import { applyPatchToFile } from './patch';
import { findPhysicalModules } from './explore-node-modules';
import { VulnIdAndPackageName, VulnPatches } from './types';
import { getAllPatches } from './fetch-patches';

async function protect(projectFolderPath: string) {
  const snykFilePath = path.resolve(projectFolderPath, '.snyk');

  if (!fs.existsSync(snykFilePath)) {
    console.log('No .snyk file found');
    return;
  }

  const snykFileContents = fs.readFileSync(snykFilePath, 'utf8');
  const snykFilePatchMetadata = extractPatchMetadata(snykFileContents);
  const vulnIdAndPackageNames: VulnIdAndPackageName[] = snykFilePatchMetadata;
  const targetPackageNames = [
    ...new Set(snykFilePatchMetadata.map((vpn) => vpn.packageName)), // get a list of unique package names by converting to Set and then back to array
  ];

  // find instances of the target packages by spelunking through the node_modules looking for modules with a target packageName
  const foundPhysicalPackages = findPhysicalModules(
    projectFolderPath,
    targetPackageNames,
  );

  // Map of package name to versions (for the target package names).
  // For each package name, we might have found multiple versions and we'll need to fetch patches for each version.
  // We will use this to lookup the versions of packages to get patches for.
  const packageNameToVersionsMap = new Map<string, string[]>();
  foundPhysicalPackages.forEach((p) => {
    if (packageNameToVersionsMap.has(p.packageName)) {
      const versions = packageNameToVersionsMap.get(p.packageName);
      if (!versions?.includes(p.packageVersion)) {
        versions?.push(p.packageVersion);
      }
    } else {
      packageNameToVersionsMap.set(p.packageName, [p.packageVersion]);
    }
  });

  const packageAtVersionsToPatches: Map<
    string,
    VulnPatches[]
  > = await getAllPatches(vulnIdAndPackageNames, packageNameToVersionsMap);

  if (packageAtVersionsToPatches.size === 0) {
    console.log('Nothing to patch, done');
    return;
  }

  foundPhysicalPackages.forEach((fpp) => {
    const packageNameAtVersion = `${fpp.packageName}@${fpp.packageVersion}`;
    const vuldIdAndPatches = packageAtVersionsToPatches.get(
      packageNameAtVersion,
    );
    vuldIdAndPatches?.forEach((vp) => {
      vp.patches.forEach((patchDiffs) => {
        patchDiffs.patchDiffs.forEach((diff) => {
          applyPatchToFile(diff, fpp.path);
        });
      });
    });
  });
}

export default protect;
