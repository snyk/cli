import * as cloneDeep from 'lodash.clonedeep';
import * as pathLib from 'path';
import * as cliInterface from '@snyk/cli-interface';
import chalk from 'chalk';
import { icon } from '../theme';
import * as debugModule from 'debug';

import { TestOptions, Options, MonitorOptions } from '../types';
import { detectPackageManagerFromFile } from '../detect';
import {
  PNPM_FEATURE_FLAG,
  SUPPORTED_MANIFEST_FILES,
  SupportedPackageManagers,
} from '../package-managers';
import { getSinglePluginResult } from './get-single-plugin-result';
import { convertSingleResultToMultiCustom } from './convert-single-splugin-res-to-multi-custom';
import { convertMultiResultToMultiCustom } from './convert-multi-plugin-res-to-multi-custom';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';
import { CallGraph } from '@snyk/cli-interface/legacy/common';
import { errorMessageWithRetry, FailedToRunTestError } from '../errors';
import { processYarnWorkspaces } from './nodejs-plugin/yarn-workspaces-parser';
import { processNpmWorkspaces } from './nodejs-plugin/npm-workspaces-parser';
import { processPnpmWorkspaces } from 'snyk-nodejs-plugin';

const debug = debugModule('snyk-test');
export interface ScannedProjectCustom
  extends cliInterface.legacyCommon.ScannedProject {
  packageManager: SupportedPackageManagers;
  plugin: PluginMetadata;
  callGraph?: CallGraph;
}

interface FailedProjectScanError {
  targetFile?: string;
  error?: Error;
  errMessage: string;
}
export interface MultiProjectResultCustom
  extends cliInterface.legacyPlugin.MultiProjectResult {
  scannedProjects: ScannedProjectCustom[];
  failedResults?: FailedProjectScanError[];
}

type WorkspaceParameters = {
  processingFunction: Function;
  lockFile: string;
};

const NODE_WORKSPACES_MAP: Record<string, WorkspaceParameters> = {
  pnpm: {
    processingFunction: processPnpmWorkspaces,
    lockFile: SUPPORTED_MANIFEST_FILES.PNPM_LOCK,
  },
  npm: {
    processingFunction: processNpmWorkspaces,
    lockFile: SUPPORTED_MANIFEST_FILES.PACKAGE_LOCK_JSON,
  },
  yarn: {
    processingFunction: processYarnWorkspaces,
    lockFile: SUPPORTED_MANIFEST_FILES.YARN_LOCK,
  },
};

export async function getMultiPluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFiles: string[],
  featureFlags: Set<string> = new Set<string>(),
): Promise<MultiProjectResultCustom> {
  const allResults: ScannedProjectCustom[] = [];
  const failedResults: FailedProjectScanError[] = [];

  // process any workspaces first
  // the files need to be proceeded together as they provide context to each other
  let unprocessedFilesfromWorkspaces = targetFiles;

  if (featureFlags.has(PNPM_FEATURE_FLAG)) {
    const { scannedProjects: scannedPnpmResults, unprocessedFiles } =
      await processWorkspacesProjects(root, options, targetFiles, 'pnpm');
    unprocessedFilesfromWorkspaces = unprocessedFiles;
    allResults.push(...scannedPnpmResults);
  }

  const {
    scannedProjects: scannedYarnResults,
    unprocessedFiles: unprocessedFilesFromYarn,
  } = await processWorkspacesProjects(
    root,
    options,
    unprocessedFilesfromWorkspaces,
    'yarn',
  );
  allResults.push(...scannedYarnResults);

  const { scannedProjects: scannedNpmResults, unprocessedFiles } =
    await processWorkspacesProjects(
      root,
      options,
      unprocessedFilesFromYarn,
      'npm',
    );
  allResults.push(...scannedNpmResults);

  debug(`Not part of a workspace: ${unprocessedFiles.join(', ')}}`);

  // process the rest 1 by 1 sent to relevant plugins
  for (const targetFile of unprocessedFiles) {
    const optionsClone = cloneDeep(options);
    optionsClone.file = pathLib.relative(root, targetFile);
    optionsClone.packageManager = detectPackageManagerFromFile(
      pathLib.basename(targetFile),
      featureFlags,
    );
    try {
      const inspectRes = await getSinglePluginResult(
        root,
        optionsClone,
        optionsClone.file,
        featureFlags,
      );
      let resultWithScannedProjects: cliInterface.legacyPlugin.MultiProjectResult;

      if (!cliInterface.legacyPlugin.isMultiResult(inspectRes)) {
        resultWithScannedProjects = convertSingleResultToMultiCustom(
          inspectRes,
          optionsClone.packageManager,
        );
      } else {
        resultWithScannedProjects = inspectRes;
      }

      const pluginResultWithCustomScannedProjects =
        convertMultiResultToMultiCustom(
          resultWithScannedProjects,
          optionsClone.packageManager,
          optionsClone.file,
        );
      // annotate the package manager, project name & targetFile to be used
      // for test & monitor
      // TODO: refactor how we display meta to not have to do this
      (options as any).projectNames =
        resultWithScannedProjects.scannedProjects.map(
          (scannedProject) => scannedProject?.depTree?.name,
        );

      allResults.push(...pluginResultWithCustomScannedProjects.scannedProjects);
    } catch (error) {
      if (
        error.name === 'NotSupportedEcosystem' ||
        error.constructor?.name === 'NotSupportedEcosystem'
      ) {
        debug(
          chalk.bold.yellow(
            `\n${icon.INFO} Skipping unsupported ecosystem for ${targetFile}: ${error.message}`,
          ),
        );
        continue;
      }

      const errMessage =
        error.message ?? 'Something went wrong getting dependencies';
      // TODO: propagate this all the way back and include in --json output
      failedResults.push({
        targetFile,
        error,
        errMessage: errMessage,
      });
      debug(
        chalk.bold.red(
          `\n${icon.ISSUE} Failed to get dependencies for ${targetFile}\nERROR: ${errMessage}\n`,
        ),
      );
    }
  }

  if (!allResults.length) {
    // No projects were scanned successfully
    let message = `Failed to get dependencies for all ${targetFiles.length} potential projects.\n`;

    if (failedResults.length > 0) {
      const errorDetails = failedResults
        .map((result) => `${result.targetFile}:\n${result.errMessage}`)
        .join('\n\n');
      message += `\n${errorDetails}`;
    } else {
      message = errorMessageWithRetry(message);
    }

    throw new FailedToRunTestError(message);
  }

  return {
    plugin: {
      name: 'custom-auto-detect',
    },
    scannedProjects: allResults,
    failedResults,
  };
}

async function processWorkspacesProjects(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFiles: string[],
  packageManager: 'npm' | 'yarn' | 'pnpm',
): Promise<{
  scannedProjects: ScannedProjectCustom[];
  unprocessedFiles: string[];
}> {
  try {
    const { scannedProjects } = await NODE_WORKSPACES_MAP[
      packageManager
    ].processingFunction(
      root,
      {
        strictOutOfSync: options.strictOutOfSync,
        dev: options.dev,
        exclude: options.exclude,
      },
      targetFiles,
    );

    const unprocessedFiles = filterOutProcessedWorkspaces(
      root,
      scannedProjects,
      targetFiles,
      NODE_WORKSPACES_MAP[packageManager].lockFile,
    );
    return { scannedProjects, unprocessedFiles };
  } catch (e) {
    debug(
      `Error during detecting or processing ${packageManager} Workspaces: `,
      e,
    );
    return { scannedProjects: [], unprocessedFiles: targetFiles };
  }
}

export function filterOutProcessedWorkspaces(
  root: string,
  scannedProjects: ScannedProjectCustom[],
  allTargetFiles: string[],
  lockFile: string,
) {
  const targetFiles: string[] = [];

  const scanned = scannedProjects
    .map((p) => p.targetFile!)
    .map((p) => pathLib.resolve(process.cwd(), root, p));
  const all = allTargetFiles.map((p) => ({
    path: pathLib.resolve(process.cwd(), root, p),
    original: p,
  }));

  for (const entry of all) {
    const { path, original } = entry;
    const { base } = pathLib.parse(path);

    if (!['package.json', lockFile].includes(base)) {
      targetFiles.push(original);
      continue;
    }
    // standardise to package.json
    // we discover the lockfiles but targetFile is package.json
    if (!scanned.includes(path.replace(lockFile, 'package.json'))) {
      targetFiles.push(original);
      continue;
    }
  }
  return targetFiles;
}
