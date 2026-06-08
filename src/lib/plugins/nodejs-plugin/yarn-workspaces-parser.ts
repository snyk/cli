import * as baseDebug from 'debug';
import * as pathUtil from 'path';
const sortBy = require('lodash.sortby');
const groupBy = require('lodash.groupby');
import * as micromatch from 'micromatch';

const debug = baseDebug('snyk-yarn-workspaces');
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import {
  MultiProjectResultCustom,
  ScannedProjectCustom,
} from '../get-multi-plugin-result';
import { getFileContents } from '../../get-file-contents';
import { NoSupportedManifestsFoundError } from '../../errors';
import { DepGraph } from '@snyk/dep-graph';

export async function processYarnWorkspaces(
  root: string,
  settings: {
    strictOutOfSync?: boolean;
    dev?: boolean;
    yarnWorkspaces?: boolean;
    showNpmScope?: boolean;
  },
  targetFiles: string[],
): Promise<MultiProjectResultCustom> {
  // the order of yarnTargetFiles folders is important
  // must have the root level most folders at the top
  const mappedAndFiltered = targetFiles
    .map((p) => ({ path: p, ...pathUtil.parse(p) }))
    .filter((res) => ['package.json', 'yarn.lock'].includes(res.base));
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
  if (settings.yarnWorkspaces && Object.keys(yarnTargetFiles).length === 0) {
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

  // Collect every workspace member's package.json up front so the lockfile parser can prune
  // dev-only dependencies of workspace packages that are consumed as production deps. Done
  // before the main loop because a consumer (e.g. apps/my-app) may be processed before the
  // member it depends on (e.g. libraries/shared-lib).
  const workspaceManifestContents: string[] = [];
  for (const directory of Object.keys(yarnTargetFiles)) {
    try {
      workspaceManifestContents.push(
        getFileContents(root, pathUtil.join(directory, 'package.json')).content,
      );
    } catch (e) {
      debug(`Could not read package.json in ${directory}: ${e}`);
    }
  }
  const workspacePackages = collectYarnWorkspacePackages(
    workspaceManifestContents,
  );

  let rootWorkspaceManifestContent = {};
  // the folders must be ordered highest first
  for (const directory of Object.keys(yarnTargetFiles)) {
    debug(`Processing ${directory} as a potential Yarn workspace`);
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

    if (!(isYarnWorkspacePackage || isRootPackageJson)) {
      debug(
        `${packageJsonFileName} is not part of any detected workspace, skipping`,
      );
      continue;
    }

    try {
      const rootDir = isYarnWorkspacePackage
        ? pathUtil.dirname(yarnWorkspacesFilesMap[packageJsonFileName].root)
        : pathUtil.dirname(packageJsonFileName);
      const rootYarnLockfileName = pathUtil.join(rootDir, 'yarn.lock');
      const yarnLock = getFileContents(root, rootYarnLockfileName);
      const lockfileVersion = lockFileParser.getYarnLockfileVersion(
        yarnLock.content,
      );

      let res: DepGraph;
      switch (lockfileVersion) {
        case lockFileParser.NodeLockfileVersion.YarnLockV1:
          res = await lockFileParser.parseYarnLockV1Project(
            packageJson.content,
            yarnLock.content,
            {
              includeDevDeps: settings.dev || false,
              includeOptionalDeps: false,
              includePeerDeps: false,
              pruneLevel: 'withinTopLevelDeps',
              strictOutOfSync:
                settings.strictOutOfSync === undefined
                  ? true
                  : settings.strictOutOfSync,

              showNpmScope: settings.showNpmScope,
            },
          );
          break;
        case lockFileParser.NodeLockfileVersion.YarnLockV2:
          res = await lockFileParser.parseYarnLockV2Project(
            packageJson.content,
            yarnLock.content,
            {
              includeDevDeps: settings.dev || false,
              includeOptionalDeps: false,
              pruneWithinTopLevelDeps: true,
              strictOutOfSync:
                settings.strictOutOfSync === undefined
                  ? true
                  : settings.strictOutOfSync,
              showNpmScope: settings.showNpmScope,
            },
            {
              isWorkspacePkg: true,
              isRoot: isRootPackageJson,
              rootResolutions:
                rootWorkspaceManifestContent?.['resolutions'] || {},
              workspacePackages,
            },
          );
          break;
        default:
          throw new Error('Failed to build dep graph from current project');
      }
      const project: ScannedProjectCustom = {
        packageManager: 'yarn',
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
      pathUtil.normalize(pathUtil.join(p, 'package.json')).replace(/\\/g, '/'),
    ),
  );
  return match;
}

export interface WorkspacePackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Build a map of workspace package name -> its package.json dependency groups.
 *
 * Yarn Berry merges a workspace member's dependencies + devDependencies into a single
 * `dependencies` block in yarn.lock, dropping the dev marker. When a workspace package is
 * consumed as a production dependency, this map lets the lockfile parser re-derive which of
 * its transitive deps are dev-only and prune them from the production graph.
 */
export function collectYarnWorkspacePackages(
  manifestContents: string[],
): Record<string, WorkspacePackageManifest> {
  const workspacePackages: Record<string, WorkspacePackageManifest> = {};
  for (const content of manifestContents) {
    try {
      const pkg = JSON.parse(content);
      if (!pkg || !pkg.name) {
        continue;
      }
      workspacePackages[pkg.name] = {
        dependencies: pkg.dependencies,
        devDependencies: pkg.devDependencies,
        optionalDependencies: pkg.optionalDependencies,
        peerDependencies: pkg.peerDependencies,
      };
    } catch (e) {
      debug('Failed to parse a workspace package.json', e.message);
    }
  }
  return workspacePackages;
}
