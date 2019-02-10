import * as fs from 'fs';
import * as path from 'path';
import {parse} from 'snyk-paket-parser';

export async function inspect(root: string, targetFile: string, options: any) {
  const manifestFileFullPath = path.resolve(root, targetFile);

  if (!fs.existsSync(manifestFileFullPath)) {
    throw new Error('Manifest ' + targetFile + ' not found at location: ' +
      manifestFileFullPath);
  }

  const fullPath = path.parse(manifestFileFullPath);
  const lockFileFullPath = path.resolve(fullPath.dir, 'paket.lock');

  if (!fs.existsSync(lockFileFullPath)) {
    throw new Error('Lockfile paket.lock not found at location: ' +
      lockFileFullPath + '. Please run `paket install` and re-run your snyk command.');
  }

  return {
    plugin: {
      name: 'paket',
      packageManager: 'nuget',
    },
    package: {
      dependencies: buildTree(fs.readFileSync(manifestFileFullPath, 'utf8')),
      hasDevDependencies: false,
      name: manifestFileFullPath,
      version: '',
    },
  };
}

// TODO: use function from snyk-paket-parser to build the tree
function buildTree(data) {
  const parsed = parse(data);
  const dependencies = {} as any;

  for (const group of parsed) {
    for (const dep of group.dependencies) {
      if (dep.source === 'nuget') {
        const nugetDep = dep as any;

        dependencies[nugetDep.name] = {
          name: nugetDep.name,
          version: nugetDep.versionRange,
          dependencies: {},
        };
      }
    }
  }

  return dependencies;
}
