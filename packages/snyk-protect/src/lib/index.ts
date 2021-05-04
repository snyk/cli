import * as fs from 'fs';
import * as path from 'path';
import { extractPatchMetadata } from './snyk-file';
import { applyPatchToFile } from './patch';
import { getPatches } from './get-patches';
import { checkProject } from './explore-node-modules';
import { PhysicalModuleToPatch } from './types';

async function protect(projectFolderPath: string) {
  const snykFilePath = path.resolve(projectFolderPath, '.snyk');

  if (!fs.existsSync(snykFilePath)) {
    console.log('No .snyk file found');
    return;
  }

  const snykFileContents = fs.readFileSync(snykFilePath, 'utf8');
  const snykFilePatchMetadata = extractPatchMetadata(snykFileContents);

  const patchesOfInterest: string[] = Object.keys(snykFilePatchMetadata); // a list of snyk vulnerability IDs

  // a list of package names (corresponding to the vulnerability IDs)
  // can't use .flat() because it's not supported in Node 10
  const librariesOfInterest: string[] = [];
  for (const nextArrayOfPackageNames of Object.values(snykFilePatchMetadata)) {
    librariesOfInterest.push(...nextArrayOfPackageNames);
  }

  const physicalModulesToPatch: PhysicalModuleToPatch[] = []; // this will be poplulated by checkProject and checkPhysicalModule

  // this fills in physicalModulesToPatch
  checkProject(projectFolderPath, librariesOfInterest, physicalModulesToPatch);

  // TODO: type this
  // it's a map of string -> something
  const snykPatches = await getPatches(
    physicalModulesToPatch,
    patchesOfInterest,
  );
  if (Object.keys(snykPatches).length === 0) {
    console.log('Nothing to patch, done');
    return;
  }

  for (const [libToPatch, patches] of Object.entries(snykPatches)) {
    for (const place of physicalModulesToPatch.filter(
      (l) => l.name === libToPatch,
    )) {
      for (const patch of patches as any) {
        for (const patchDiff of (patch as any).diffs) {
          applyPatchToFile(patchDiff, place.folderPath);
        }
      }
    }
  }
}

export default protect;
