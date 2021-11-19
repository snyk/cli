const cloneDeep = require('lodash.clonedeep');
import * as pathLib from 'path';
import sortBy = require('lodash.sortby');
import groupBy = require('lodash.groupby');
import * as cliInterface from '@snyk/cli-interface';
import chalk from 'chalk';
import { icon } from '../theme';
import * as debugModule from 'debug';

import { TestOptions, Options, MonitorOptions } from '../types';
import { detectPackageManagerFromFile } from '../detect';
import { SupportedPackageManagers } from '../package-managers';
import { getSinglePluginResult } from './get-single-plugin-result';
import { convertSingleResultToMultiCustom } from './convert-single-splugin-res-to-multi-custom';
import { convertMultiResultToMultiCustom } from './convert-multi-plugin-res-to-multi-custom';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';
import { CallGraph } from '@snyk/cli-interface/legacy/common';
import { errorMessageWithRetry, FailedToRunTestError } from '../errors';
import { processYarnWorkspaces } from './nodejs-plugin/yarn-workspaces-parser';

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

export async function getMultiPluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFiles: string[],
): Promise<MultiProjectResultCustom> {
  const allResults: ScannedProjectCustom[] = [];
  const failedResults: FailedProjectScanError[] = [];

  // process any yarn workspaces first
  // the files need to be proceeded together as they provide context to each other
  const {
    scannedProjects,
    unprocessedFiles,
  } = await processYarnWorkspacesProjects(root, options, targetFiles);
  allResults.push(...scannedProjects);
  // process the rest 1 by 1 sent to relevant plugins
  for (const targetFile of unprocessedFiles) {
    const optionsClone = cloneDeep(options);
    optionsClone.file = pathLib.relative(root, targetFile);
    optionsClone.packageManager = detectPackageManagerFromFile(
      pathLib.basename(targetFile),
    );
    try {
      const inspectRes = await getSinglePluginResult(
        root,
        optionsClone,
        optionsClone.file,
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

      const pluginResultWithCustomScannedProjects = convertMultiResultToMultiCustom(
        resultWithScannedProjects,
        optionsClone.packageManager,
        optionsClone.file,
      );
      // annotate the package manager, project name & targetFile to be used
      // for test & monitor
      // TODO: refactor how we display meta to not have to do this
      (options as any).projectNames = resultWithScannedProjects.scannedProjects.map(
        (scannedProject) => scannedProject?.depTree?.name,
      );

      allResults.push(...pluginResultWithCustomScannedProjects.scannedProjects);
    } catch (error) {
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
    throw new FailedToRunTestError(
      errorMessageWithRetry(
        `Failed to get dependencies for all ${targetFiles.length} potential projects.`,
      ),
    );
  }

  return {
    plugin: {
      name: 'custom-auto-detect',
    },
    scannedProjects: allResults,
    failedResults,
  };
}

async function processYarnWorkspacesProjects(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFiles: string[],
): Promise<{
  scannedProjects: ScannedProjectCustom[];
  unprocessedFiles: string[];
}> {
  try {
    const { scannedProjects } = await processYarnWorkspaces(
      root,
      {
        strictOutOfSync: options.strictOutOfSync,
        dev: options.dev,
      },
      targetFiles,
    );

    const unprocessedFiles = filterOutProcessedWorkspaces(
      scannedProjects,
      targetFiles,
    );
    return { scannedProjects, unprocessedFiles };
  } catch (e) {
    debug('Error during detecting or processing Yarn Workspaces: ', e);
    return { scannedProjects: [], unprocessedFiles: targetFiles };
  }
}

function filterOutProcessedWorkspaces(
  scannedProjects: ScannedProjectCustom[],
  allTargetFiles: string[],
): string[] {
  const mapped = allTargetFiles.map((p) => ({ path: p, ...pathLib.parse(p) }));
  const sorted = sortBy(mapped, 'dir');
  const targetFilesByDirectory: {
    [dir: string]: Array<{
      path: string;
      base: string;
      dir: string;
    }>;
  } = groupBy(sorted, 'dir');

  const scanned = scannedProjects.map((p) => p.targetFile!);
  const targetFiles: string[] = [];

  for (const directory of Object.keys(targetFilesByDirectory)) {
    for (const targetFile of targetFilesByDirectory[directory]) {
      const { base, path } = targetFile;

      // any non yarn workspace files should be scanned
      if (!['package.json', 'yarn.lock'].includes(base)) {
        targetFiles.push(path);
        continue;
      }

      // check if Node manifest has already been processed a part or a workspace
      const packageJsonFileName = pathLib.join(directory, 'package.json');
      const alreadyScanned = scanned.some((f) =>
        packageJsonFileName.endsWith(f),
      );
      if (!alreadyScanned) {
        targetFiles.push(path);
      }
    }
  }
  return targetFiles;
}
