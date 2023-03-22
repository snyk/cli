import * as baseDebug from 'debug';
import * as pathUtil from 'path';
const sortBy = require('lodash.sortby');
const groupBy = require('lodash.groupby');
import * as micromatch from 'micromatch';

const debug = baseDebug('snyk-npm-workspaces');
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import {
  MultiProjectResultCustom,
  ScannedProjectCustom,
} from '../get-multi-plugin-result';
import { getFileContents } from '../../get-file-contents';
import { NoSupportedManifestsFoundError } from '../../errors';

export async function processNpmWorkspaces(
  root: string,
  settings: {
    strictOutOfSync?: boolean;
    dev?: boolean;
    yarnWorkspaces?: boolean;
  },
  targetFiles: string[],
): Promise<MultiProjectResultCustom> {
  // the order of npmTargetFiles folders is important
  // must have the root level most folders at the top
  const mappedAndFiltered = targetFiles
    .map((p) => ({ path: p, ...pathUtil.parse(p) }))
    .filter((res) => ['package.json', 'package-lock.json'].includes(res.base));
  const sorted = sortBy(mappedAndFiltered, 'dir');
  const grouped = groupBy(sorted, 'dir');

  const npmTargetFiles: {
    [dir: string]: Array<{
      path: string;
      base: string;
      dir: string;
    }>;
  } = grouped;

  debug(`Processing potential Npm workspaces (${targetFiles.length})`);
  if (settings.yarnWorkspaces && Object.keys(npmTargetFiles).length === 0) {
    throw NoSupportedManifestsFoundError([root]);
  }
  let npmWorkspacesMap = {};
  const workspacesFilesMap = {};
  const result: MultiProjectResultCustom = {
    plugin: {
      name: 'snyk-nodejs-npm-workspaces',
      runtime: process.version,
    },
    scannedProjects: [],
  };
  // the folders must be ordered highest first
  for (const directory of Object.keys(npmTargetFiles)) {
    debug(`Processing ${directory} as a potential npm workspace`);
    let isWorkspacePackage = false;
    let isRootPackageJson = false;
    const packageJsonFileName = pathUtil.join(directory, 'package.json');
    const packageJson = getFileContents(root, packageJsonFileName);
    npmWorkspacesMap = {
      ...npmWorkspacesMap,
      ...getWorkspacesMap(packageJson),
    };
    for (const workspaceRoot of Object.keys(npmWorkspacesMap)) {
      const match = packageJsonBelongsToWorkspace(
        packageJsonFileName,
        npmWorkspacesMap,
        workspaceRoot,
      );
      if (match) {
        debug(`${packageJsonFileName} matches an existing workspace pattern`);
        workspacesFilesMap[packageJsonFileName] = {
          root: workspaceRoot,
        };
        isWorkspacePackage = true;
      }
      if (packageJsonFileName === workspaceRoot) {
        isRootPackageJson = true;
      }
    }

    if (!(isWorkspacePackage || isRootPackageJson)) {
      debug(
        `${packageJsonFileName} is not part of any detected workspace, skipping`,
      );
      continue;
    }
    try {
      const rootDir = isWorkspacePackage
        ? pathUtil.dirname(workspacesFilesMap[packageJsonFileName].root)
        : pathUtil.dirname(packageJsonFileName);
      const rootLockfileName = pathUtil.join(rootDir, 'package-lock.json');
      const lockContent = getFileContents(root, rootLockfileName);

      const res = lockFileParser.parseNpmLockV2Project(
        packageJson.content,
        lockContent.content,
        {
          includeDevDeps: settings.dev || false,
          strictOutOfSync: settings.strictOutOfSync || false,
          includeOptionalDeps: false,
          pruneCycles: true,
        },
      );

      const project: ScannedProjectCustom = {
        packageManager: 'npm',
        targetFile: pathUtil.relative(root, packageJson.fileName),
        depGraph: res as any,
        plugin: {
          name: 'snyk-nodejs-lockfile-parser',
          runtime: process.version,
        },
      };
      result.scannedProjects.push(project);
    } catch (e) {
      if (settings.yarnWorkspaces) {
        throw e;
      }
      debug(`Error process workspace: ${packageJsonFileName}. ERROR: ${e}`);
    }
  }
  if (!result.scannedProjects.length) {
    debug(
      `No npm workspaces detected in any of the ${targetFiles.length} target files.`,
    );
  }
  return result;
}

interface NpmWorkspacesMap {
  [packageJsonName: string]: {
    workspaces: string[];
  };
}

export function getWorkspacesMap(file: {
  content: string;
  fileName: string;
}): NpmWorkspacesMap {
  const workspacesMap = {};
  if (!file) {
    return workspacesMap;
  }

  try {
    const rootFileWorkspacesDefinitions =
      JSON.parse(file.content).workspaces || false;
    if (rootFileWorkspacesDefinitions && rootFileWorkspacesDefinitions.length) {
      workspacesMap[file.fileName] = {
        workspaces: rootFileWorkspacesDefinitions,
      };
    }
  } catch (e) {
    debug('Failed to process a workspace', e.message);
  }
  return workspacesMap;
}

export function packageJsonBelongsToWorkspace(
  packageJsonFileName: string,
  workspacesMap: NpmWorkspacesMap,
  workspaceRoot: string,
): boolean {
  const workspaceRootFolder = pathUtil.dirname(
    workspaceRoot.replace(/\\/g, '/'),
  );
  const workspacesGlobs = (
    workspacesMap[workspaceRoot].workspaces || []
  ).map((workspace) => pathUtil.join(workspaceRootFolder, workspace));

  const match = micromatch.isMatch(
    packageJsonFileName.replace(/\\/g, '/'),
    workspacesGlobs.map((p) =>
      pathUtil.normalize(pathUtil.join(p, 'package.json')).replace(/\\/g, '/'),
    ),
  );
  return match;
}
