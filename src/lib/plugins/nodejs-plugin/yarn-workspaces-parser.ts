import * as baseDebug from 'debug';
const debug = baseDebug('yarn-workspaces');
import * as fs from 'fs';
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import * as path from 'path';
import { NoSupportedManifestsFoundError } from '../../errors';
import {
  MultiProjectResultCustom,
  ScannedProjectCustom,
} from '../get-multi-plugin-result';

export async function processYarnWorkspaces(
  root: string,
  settings: {
    strictOutOfSync?: boolean;
    scanDevDependencies?: boolean;
  },
  targetFiles: string[],
): Promise<MultiProjectResultCustom> {
  const yarnTargetFiles = targetFiles.filter((f) => f.endsWith('package.json'));
  debug(`processing Yarn workspaces (${targetFiles.length})`);
  if (yarnTargetFiles.length === 0) {
    throw NoSupportedManifestsFoundError([root]);
  }
  let yarnWorkspacesMap = {};
  const yarnWorkspacesFilesMap = {};
  let isYarnWorkspacePackage = false;
  const result: MultiProjectResultCustom = {
    plugin: {
      name: 'snyk-nodejs-yarn-workspaces',
      runtime: process.version,
    },
    scannedProjects: [],
  };
  for (const packageJsonFileName of yarnTargetFiles) {
    const packageJson = getFileContents(root, packageJsonFileName);
    yarnWorkspacesMap = {
      ...yarnWorkspacesMap,
      ...getWorkspacesMap(packageJson),
    };

    for (const workspaceRoot of Object.keys(yarnWorkspacesMap)) {
      const workspaces = yarnWorkspacesMap[workspaceRoot].workspaces || [];
      const match = workspaces
        .map((pattern) =>
          packageJsonFileName.includes(pattern.replace(/\*/, '')),
        )
        .filter(Boolean);

      if (match) {
        yarnWorkspacesFilesMap[packageJsonFileName] = {
          root: workspaceRoot,
        };
        isYarnWorkspacePackage = true;
      }
    }

    if (isYarnWorkspacePackage) {
      const rootDir = path.dirname(
        yarnWorkspacesFilesMap[packageJsonFileName].root,
      );
      const rootYarnLockfileName = path.join(rootDir, 'yarn.lock');

      const yarnLock = await getFileContents(root, rootYarnLockfileName);
      const res = await lockFileParser.buildDepTree(
        packageJson.content,
        yarnLock.content,
        settings.scanDevDependencies,
        lockFileParser.LockfileType.yarn,
        settings.strictOutOfSync !== false,
      );
      const project: ScannedProjectCustom = {
        packageManager: 'yarn',
        targetFile: path.parse(packageJson.name).base,
        depTree: res as any,
        plugin: {
          name: 'snyk-nodejs-lockfile-parser',
          runtime: process.version,
        },
      };
      result.scannedProjects.push(project);
    }
  }
  return result;
}

function getFileContents(
  root: string,
  fileName: string,
): {
  content: string;
  name: string;
} {
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

interface YarnWorkspacesMap {
  [packageJsonName: string]: {
    workspaces: string[];
  };
}

export function getWorkspacesMap(file: {
  content: string;
  name: string;
}): YarnWorkspacesMap {
  const yarnWorkspacesMap = {};
  if (!file) {
    return yarnWorkspacesMap;
  }

  try {
    const rootFileWorkspacesDefinitions = lockFileParser.getYarnWorkspaces(
      file.content,
    );

    if (rootFileWorkspacesDefinitions && rootFileWorkspacesDefinitions.length) {
      yarnWorkspacesMap[file.name] = {
        workspaces: rootFileWorkspacesDefinitions,
      };
    }
  } catch (e) {
    debug('Failed to process a workspace', e.message);
  }
  return yarnWorkspacesMap;
}
