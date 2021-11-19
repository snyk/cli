const cloneDeep = require('lodash.clonedeep');
import * as path from 'path';
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
import { FailedToRunTestError } from '../errors';
import { reTryMessage, contactSupportMessage } from '../common';

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

  for (const targetFile of targetFiles) {
    const optionsClone = cloneDeep(options);
    optionsClone.file = path.relative(root, targetFile);
    optionsClone.packageManager = detectPackageManagerFromFile(
      path.basename(targetFile),
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
    } catch (err) {
      // TODO: propagate this all the way back and include in --json output
      failedResults.push({
        targetFile,
        error: err,
        errMessage: err.message || 'Something went wrong getting dependencies',
      });
      debug(
        chalk.bold.red(
          `\n${icon.ISSUE} Failed to get dependencies for ${targetFile}\nERROR: ${err.message}\n`,
        ),
      );
    }
  }

  if (!allResults.length) {
    throw new FailedToRunTestError(
      `Failed to get dependencies for all ${targetFiles.length} potential projects.\n${reTryMessage}. ${contactSupportMessage}`,
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
