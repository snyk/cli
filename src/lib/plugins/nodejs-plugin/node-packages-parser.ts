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
import { MultiScanType } from '../types';

type SupportedNodePackagesScanTypes = 'yarnWorkspaces' | 'lernaPackages';
interface ScanTypeConfiguration {
  handler: (targetFile: string) => false | string[];
  pluginName: string;
  packagesDefinitionFileName: string;
}

const rootLockFileNames = {
  npm: 'package-lock.json',
  yarn: 'yarn.lock',
};

const packagesScanConfigurations: {
  [key in SupportedNodePackagesScanTypes]: ScanTypeConfiguration;
} = {
  yarnWorkspaces: {
    handler: lockFileParser.getYarnWorkspaces,
    pluginName: 'snyk-nodejs-yarn-workspaces',
    packagesDefinitionFileName: 'package.json',
  },
  lernaPackages: {
    handler: getNpmPackagesDefinition,
    pluginName: 'snyk-nodejs-lerna-npm',
    packagesDefinitionFileName: 'lerna.json',
  },
};

interface PackagesMap {
  [packageJsonName: string]: {
    packages: string[];
    npmClient: 'npm' | 'yarn';
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
  if (!packagesScanConfigurations[type]) {
    debug(`Multi Node.js packages scanning not supported for ${type}`);
    throw new Error(
      `Failed to process ${targetFiles.length} manifests as Node.js packages (Lerna/Yarn Workspaces)`,
    );
  }

  const { pluginName, packagesDefinitionFileName } = packagesScanConfigurations[
    type
  ];

  debug(`Processing ${targetFiles.length} manifests (${type})`);

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
  const packagesFilesMap: {
    [packageJsonPath: string]: {
      root: string;
      npmClient: 'yarn' | 'npm';
    };
  } = {};
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
    const packagesFileName = pathUtil.join(
      directory,
      packagesDefinitionFileName,
    );
    let packagesDefinitionFile;
    try {
      packagesDefinitionFile = getFileContents(root, packagesFileName);
    } catch (e) {
      // do nothing;
    }

    if (packagesDefinitionFile) {
      packagesMap = {
        ...packagesMap,
        ...getPackagesMap(
          packagesDefinitionFile,
          type as SupportedNodePackagesScanTypes,
        ),
      };
    }

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
          npmClient: packagesMap[packagesRoot].npmClient,
        };
        isNodePackage = true;
      }
    }

    if (isNodePackage) {
      const { npmClient, root: packagesRoot } = packagesFilesMap[
        packageJsonFileName
      ];

      const rootDir = path.dirname(packagesRoot);
      const rootLockfileNamePath = path.join(
        rootDir,
        rootLockFileNames[npmClient],
      );

      const lockfile = await getFileContents(root, rootLockfileNamePath);
      const res = await lockFileParser.buildDepTree(
        packageJson.content,
        lockfile.content,
        settings.dev,
        lockFileParser.LockfileType[npmClient],
        settings.strictOutOfSync !== false,
      );
      const project: ScannedProjectCustom = {
        packageManager: npmClient,
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
  type: SupportedNodePackagesScanTypes,
): PackagesMap {
  const packagesMap: PackagesMap = {};
  if (!file) {
    return packagesMap;
  }

  try {
    const packagesDefinition = packagesScanConfigurations[type].handler(
      file.content,
    );

    if (packagesDefinition && packagesDefinition.length) {
      const npmClient =
        type === 'yarnWorkspaces' ? 'yarn' : getLernaNpmClient(file.content);
      packagesMap[file.name] = {
        packages: packagesDefinition,
        npmClient,
      };
    }
  } catch (e) {
    debug('Failed to process a package', e.message);
  }
  return packagesMap;
}

function getLernaNpmClient(content: string): 'npm' | 'yarn' {
  try {
    const lernaJson = JSON.parse(content);
    if (lernaJson.npmClient && ['npm', 'yarn'].includes(lernaJson.npmClient)) {
      return lernaJson.npmClient;
    }
    return 'npm';
  } catch (e) {
    throw new Error(`lerna.json parsing failed with error: ${e.message}`);
  }
}

function getNpmPackagesDefinition(content: string): string[] | false {
  try {
    const lernaJson = JSON.parse(content);
    if (lernaJson.packages) {
      const workspacesPackages = lernaJson.packages as string[];
      const workspacesAlternateConfigPackages = (workspacesPackages as any)
        .packages;
      return [...(workspacesAlternateConfigPackages || workspacesPackages)];
    }
    return false;
  } catch (e) {
    throw new Error(`lerna.json parsing failed with error: ${e.message}`);
  }
}
