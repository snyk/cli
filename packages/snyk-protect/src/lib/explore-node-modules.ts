import * as fs from 'fs';
import * as path from 'path';
import { FoundPhysicalPackage } from './types';

/**
 * Check if a physical module (given by folderPath) is one of the package names we are interested in for patching.
 * If it is, capture it as a FoundPhysicalPackage containing the name, version, and path
 * @param folderPath the physical path of the module under consideration.
 * @param packageNamesOfInterest a list of package names we are considering for patching.
 * @returns a FoundPhysicalPackage if the module at the given path has a package name which we are considering for patching.
 */
function checkPhysicalModule(
  folderPath: string,
  packageNamesOfInterest: Readonly<string[]>,
): FoundPhysicalPackage | undefined {
  const folderName = path.basename(folderPath);
  if (packageNamesOfInterest.includes(folderName)) {
    const packageJsonPath = path.resolve(folderPath, 'package.json');
    if (
      fs.existsSync(packageJsonPath) &&
      fs.lstatSync(packageJsonPath).isFile()
    ) {
      const { name, version } = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf8'),
      );
      if (packageNamesOfInterest.includes(name)) {
        const foundPackage: FoundPhysicalPackage = {
          packageName: name,
          packageVersion: version,
          path: folderPath,
        };
        return foundPackage;
      }
    }
  }
  return undefined;
}

/**
 * Explore the node_modules of a project, starting with the given path and recusively exploring deeper,
 * looking for modules which match the package names we are considering for patching.
 * @param pathToCheck the path to look for a matching module.
 * @param packageNamesOfInterest - a list of package names we are considering for patching.
 * @returns
 */
export function findPhysicalModules(
  pathToCheck: string,
  packageNamesOfInterest: Readonly<string[]>,
): FoundPhysicalPackage[] {
  if (fs.existsSync(pathToCheck) && fs.lstatSync(pathToCheck).isDirectory()) {
    const foundPhysicalPackages: FoundPhysicalPackage[] = [];
    const foundAtThisLocation = checkPhysicalModule(
      pathToCheck,
      packageNamesOfInterest,
    );
    if (foundAtThisLocation) {
      foundPhysicalPackages.push(foundAtThisLocation);
    }

    const folderNodeModules = path.resolve(pathToCheck, 'node_modules');
    if (
      fs.existsSync(folderNodeModules) &&
      fs.lstatSync(folderNodeModules).isDirectory()
    ) {
      fs.readdirSync(folderNodeModules).forEach((p) => {
        const foundPhysicalPackagesInSubModules = findPhysicalModules(
          path.resolve(folderNodeModules, p),
          packageNamesOfInterest,
        );
        foundPhysicalPackages.push(...foundPhysicalPackagesInSubModules);
      });
    }

    return foundPhysicalPackages;
  } else {
    return [];
  }
}
