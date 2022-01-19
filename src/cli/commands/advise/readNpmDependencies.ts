import { Package } from './types';
import * as fse from 'fs-extra';

export const readNpmDependencies = async (packageJsonPath: string): Promise<Package[]> => {
  const currentPackageJson = await fse.readFile(packageJsonPath, 'utf-8');
  const packageJson: PackageJSON = JSON.parse(currentPackageJson);
  const packageJsonDependencies = packageJson.dependencies;
  return Object.keys(packageJsonDependencies).map(dependency => ({
    name: dependency,
  }))
}

type PackageJSON = {
  dependencies: Record<string, string>;
};
