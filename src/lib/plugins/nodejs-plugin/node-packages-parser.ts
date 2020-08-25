import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import * as baseDebug from 'debug';
import * as pathUtil from 'path';
import * as _ from '@snyk/lodash';

const debug = baseDebug('snyk:node-packages');
import * as fs from 'fs';
import * as path from 'path';
import { NoSupportedManifestsFoundError } from '../../errors';
import {
  MultiProjectResultCustom,
  ScannedProjectCustom,
} from '../get-multi-plugin-result';
import { SupportedPackageManagers } from '../../package-managers';
import { MultiScanType } from '../types';

const packagesDefinitionProcessor = {
  yarnWorkspaces: {
    handler: lockFileParser.getYarnWorkspaces,
    rootLockFileName: 'yarn.lock',
    packageManager: 'yarn' as SupportedPackageManagers,
    pluginName: 'snyk-nodejs-yarn-workspaces',
  },
};

interface PackagesMap {
  [packageJsonName: string]: {
    packages: string[];
  };
}

export async function processNodePackages(
  root: string,
  settings: {
    strictOutOfSync?: boolean;
    dev?: boolean;
  },
  targetFiles: string[],
  type: MultiScanType,
): Promise<MultiProjectResultCustom> {
  const packageManager: SupportedPackageManagers =
    packagesDefinitionProcessor[type].packageManager;
  const pluginName: string = packagesDefinitionProcessor[type].pluginName;
  debug(`Processing ${targetFiles.length} manifests (${type}`);

  // the order of folders is important
  // must have the root level most folders at the top
  const packageJsonFiles: {
    [dir: string]: Array<{
      path: string;
      base: string;
      dir: string;
    }>;
  } = _(targetFiles)
    .map((p) => ({ path: p, ...pathUtil.parse(p) }))
    .filter((res) => ['package.json'].includes(res.base))
    .sortBy('dir')
    .groupBy('dir')
    .value();

  if (Object.keys(packageJsonFiles).length === 0) {
    throw NoSupportedManifestsFoundError([root]);
  }
  let packagesMap: PackagesMap = {};
  const packagesFilesMap = {};
  let isNodePackage = false;
  const result: MultiProjectResultCustom = {
    plugin: {
      name: pluginName,
      runtime: process.version,
    },
    scannedProjects: [],
  };
  // the folders must be ordered highest first
  for (const directory of Object.keys(packageJsonFiles)) {
    const packageJsonFileName = pathUtil.join(directory, 'package.json');
    const packageJson = getFileContents(root, packageJsonFileName);
    packagesMap = {
      ...packagesMap,
      ...getPackagesMap(packageJson, type as 'yarnWorkspaces'),
    };
    for (const packagesRoot of Object.keys(packagesMap)) {
      const packages = packagesMap[packagesRoot].packages || [];
      const match = packages
        .map((pattern) =>
          packageJsonFileName.includes(pattern.replace(/\*/, '')),
        )
        .filter(Boolean);

      if (match) {
        packagesFilesMap[packageJsonFileName] = {
          root: packagesRoot,
        };
        isNodePackage = true;
      }
    }

    if (isNodePackage) {
      const rootDir = path.dirname(packagesFilesMap[packageJsonFileName].root);
      const rootLockfileName = path.join(
        rootDir,
        packagesDefinitionProcessor[type].rootLockFileName,
      );

      const lockfile = await getFileContents(root, rootLockfileName);
      const res = await lockFileParser.buildDepTree(
        packageJson.content,
        lockfile.content,
        settings.dev,
        lockFileParser.LockfileType[packageManager],
        settings.strictOutOfSync !== false,
      );
      const project: ScannedProjectCustom = {
        packageManager,
        targetFile: path.relative(root, packageJson.name),
        depTree: res as any,
        plugin: {
          name: pluginName,
          runtime: process.version,
        },
      };
      result.scannedProjects.push(project);
    }
  }
  return result;
}

interface File {
  content: string;
  name: string;
}

function getFileContents(root: string, fileName: string): File {
  const fullPath = path.resolve(root, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      'Manifest ' + fileName + ' not found at location: ' + fileName,
    );
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return {
    content,
    name: fileName,
  };
}

export function getPackagesMap(
  file: File,
  type: 'yarnWorkspaces',
): PackagesMap {
  const packagesMap: PackagesMap = {};
  if (!file) {
    return packagesMap;
  }

  try {
    const packagesDefinition = packagesDefinitionProcessor[type].handler(
      file.content,
    );

    if (packagesDefinition && packagesDefinition.length) {
      packagesMap[file.name] = {
        packages: packagesDefinition,
      };
    }
  } catch (e) {
    debug('Failed to process a package', e.message);
  }
  return packagesMap;
}
