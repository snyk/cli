import * as fs from 'fs';
import * as path from 'path';
import { PhysicalModuleToPatch } from './types';

// Check if a physical module (given by folderPath) is a thing we want to patch and if it is, add it to the list of modules to patch
// for a given path and
function checkPhysicalModule(
  folderPath: string,
  librariesOfInterest: Readonly<string[]>,
  physicalModulesToPatch: PhysicalModuleToPatch[],
) {
  const folderName = path.basename(folderPath);
  if (!librariesOfInterest.includes(folderName)) {
    return false;
  }

  const packageJsonPath = path.resolve(folderPath, 'package.json');
  if (
    fs.existsSync(packageJsonPath) &&
    fs.lstatSync(packageJsonPath).isFile()
  ) {
    const { name, version } = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    );
    if (librariesOfInterest.includes(name)) {
      physicalModulesToPatch.push({
        name,
        version,
        folderPath,
      } as PhysicalModuleToPatch);
    }
  }
}

// splelunk down the node_modules folder of a project given the project root directory looking for
// physical modules which match our librariesOfInterest
// we do not check for matching version at this point (that happens in getPatches)
// calls checkPhysicalModule
// calls itself recursively
export function checkProject(
  pathToCheck: string,
  librariesOfInterest: Readonly<string[]>,
  physicalModulesToPatch: PhysicalModuleToPatch[],
) {
  if (fs.existsSync(pathToCheck) && fs.lstatSync(pathToCheck).isDirectory()) {
    checkPhysicalModule(
      pathToCheck,
      librariesOfInterest,
      physicalModulesToPatch,
    );

    const folderNodeModules = path.resolve(pathToCheck, 'node_modules');
    if (
      fs.existsSync(folderNodeModules) &&
      fs.lstatSync(folderNodeModules).isDirectory()
    ) {
      fs.readdirSync(folderNodeModules).forEach((p) => {
        checkProject(
          path.resolve(folderNodeModules, p),
          librariesOfInterest,
          physicalModulesToPatch,
        );
      });
    }
  }
}
