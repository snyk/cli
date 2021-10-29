import * as baseDebug from 'debug';
import * as pathUtil from 'path';
// import * as _ from 'lodash';
const sortBy = require('lodash.sortby');
const groupBy = require('lodash.groupby');
import * as micromatch from 'micromatch';

const debug = baseDebug('snyk-yarn-workspaces');
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import { NoSupportedManifestsFoundError } from '../../errors';
import {
  MultiProjectResultCustom,
  ScannedProjectCustom,
} from '../get-multi-plugin-result';
import { getFileContents } from '../../get-file-contents';

export async function processYarnWorkspaces(
  root: string,
  settings: {
    strictOutOfSync?: boolean;
    dev?: boolean;
  },
  targetFiles: string[],
): Promise<MultiProjectResultCustom> {
  // the order of yarnTargetFiles folders is important
  // must have the root level most folders at the top
  const mappedAndFiltered = targetFiles
    .map((p) => ({ path: p, ...pathUtil.parse(p) }))
    .filter((res) => ['package.json'].includes(res.base));
  const sorted = sortBy(mappedAndFiltered, 'dir');
  const grouped = groupBy(sorted, 'dir');

  const yarnTargetFiles: {
    [dir: string]: Array<{
      path: string;
      base: string;
      dir: string;
    }>;
  } = grouped;

  debug(`Processing potential Yarn workspaces (${targetFiles.length})`);
  if (Object.keys(yarnTargetFiles).length === 0) {
    throw NoSupportedManifestsFoundError([root]);
  }
  let yarnWorkspacesMap = {};
  const yarnWorkspacesFilesMap = {};
  const result: MultiProjectResultCustom = {
    plugin: {
      name: 'snyk-nodejs-yarn-workspaces',
      runtime: process.version,
    },
    scannedProjects: [],
  };
  let rootWorkspaceManifestContent = {};
  // the folders must be ordered highest first
  for (const directory of Object.keys(yarnTargetFiles)) {
    let isYarnWorkspacePackage = false;
    let isRootPackageJson = false;
    const packageJsonFileName = pathUtil.join(directory, 'package.json');
    const packageJson = getFileContents(root, packageJsonFileName);
    yarnWorkspacesMap = {
      ...yarnWorkspacesMap,
      ...getWorkspacesMap(packageJson),
    };
    for (const workspaceRoot of Object.keys(yarnWorkspacesMap)) {
      const match = packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMap,
        workspaceRoot,
      );
      if (match) {
        debug(`${packageJsonFileName} matches an existing workspace pattern`);
        yarnWorkspacesFilesMap[packageJsonFileName] = {
          root: workspaceRoot,
        };
        isYarnWorkspacePackage = true;
      }
      if (packageJsonFileName === workspaceRoot) {
        isRootPackageJson = true;
        rootWorkspaceManifestContent = JSON.parse(packageJson.content);
      }
    }

    if (isYarnWorkspacePackage || isRootPackageJson) {
      const rootDir = isYarnWorkspacePackage
        ? pathUtil.dirname(yarnWorkspacesFilesMap[packageJsonFileName].root)
        : pathUtil.dirname(packageJsonFileName);
      const rootYarnLockfileName = pathUtil.join(rootDir, 'yarn.lock');
      const yarnLock = await getFileContents(root, rootYarnLockfileName);

      if (
        rootWorkspaceManifestContent.hasOwnProperty('resolutions') &&
        lockFileParser.getYarnLockfileType(yarnLock.content) ===
          lockFileParser.LockfileType.yarn2
      ) {
        const parsedManifestContent = JSON.parse(packageJson.content);
        packageJson.content = JSON.stringify({
          ...parsedManifestContent,
          resolutions: rootWorkspaceManifestContent['resolutions'],
        });
      }

      const res = await lockFileParser.buildDepTree(
        packageJson.content,
        yarnLock.content,
        settings.dev,
        lockFileParser.LockfileType.yarn,
        settings.strictOutOfSync !== false,
      );
      const project: ScannedProjectCustom = {
        packageManager: 'yarn',
        targetFile: pathUtil.relative(root, packageJson.fileName),
        depTree: res as any,
        plugin: {
          name: 'snyk-nodejs-lockfile-parser',
          runtime: process.version,
        },
      };
      result.scannedProjects.push(project);
    } else {
      debug(
        `${packageJsonFileName} is not part of any detected workspace, skipping`,
      );
    }
  }
  if (!result.scannedProjects.length) {
    debug(
      `No yarn workspaces detected in any of the ${targetFiles.length} target files.`,
    );
  }
  return result;
}

interface YarnWorkspacesMap {
  [packageJsonName: string]: {
    workspaces: string[];
  };
}

export function getWorkspacesMap(file: {
  content: string;
  fileName: string;
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
      yarnWorkspacesMap[file.fileName] = {
        workspaces: rootFileWorkspacesDefinitions,
      };
    }
  } catch (e) {
    debug('Failed to process a workspace', e.message);
  }
  return yarnWorkspacesMap;
}

export function packageJsonBelongsToWorkspace(
  packageJsonFileName: string,
  yarnWorkspacesMap: YarnWorkspacesMap,
  workspaceRoot: string,
): boolean {
  const workspaceRootFolder = pathUtil.dirname(
    workspaceRoot.replace(/\\/g, '/'),
  );
  const workspacesGlobs = (
    yarnWorkspacesMap[workspaceRoot].workspaces || []
  ).map((workspace) => pathUtil.join(workspaceRootFolder, workspace));

  const match = micromatch.isMatch(
    packageJsonFileName.replace(/\\/g, '/'),
    workspacesGlobs.map((p) =>
      pathUtil.normalize(pathUtil.join(p, '**')).replace(/\\/g, '/'),
    ),
  );
  return match;
}
