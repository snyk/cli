import * as _ from '@snyk/lodash';
import * as path from 'path';
import * as cliInterface from '@snyk/cli-interface';
import chalk from 'chalk';
import * as debugModule from 'debug';

import { TestOptions, Options, MonitorOptions } from '../types';
import { detectPackageManagerFromFile } from '../detect';
import { SupportedPackageManagers } from '../package-managers';
import { getSinglePluginResult } from './get-single-plugin-result';
import { convertSingleResultToMultiCustom } from './convert-single-splugin-res-to-multi-custom';
import { convertMultiResultToMultiCustom } from './convert-multi-plugin-res-to-multi-custom';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';
import { CallGraph } from '@snyk/cli-interface/legacy/common';
import { FailedTestResult } from '../snyk-test/legacy';
import { saveErrorsToFile } from '../log-errors-to-snyk-folder';

const debug = debugModule('snyk-test');
export interface ScannedProjectCustom
  extends cliInterface.legacyCommon.ScannedProject {
  packageManager: SupportedPackageManagers;
  plugin: PluginMetadata;
  callGraph?: CallGraph;
}
export interface MultiProjectResultCustom
  extends cliInterface.legacyPlugin.MultiProjectResult {
  scannedProjects: ScannedProjectCustom[];
}

export async function getMultiPluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFiles: string[],
): Promise<MultiProjectResultCustom> {
  const failedResults: FailedTestResult[] = [];
  const allResults: ScannedProjectCustom[] = [];
  for (const targetFile of targetFiles) {
    const optionsClone = _.cloneDeep(options);
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
      failedResults.push({
        targetFile: optionsClone.file,
        err,
        errorMsg: err.message || 'Failed to inspect dependencies',
      });
      debug(chalk.bold.red(err.message));
    }
  }

  if (!allResults.length) {
    if (allResults.length === 1) {
      throw failedResults[0].err;
    }
    throw new Error(
      `Failed to get vulnerabilities for all ${targetFiles.length} projects`,
    );
  }
  if (failedResults.length) {
    console.warn(
      chalk.bold.red(
        '\nSome projects failed while extracting dependencies, for more details see .snyk-debug',
      ),
    );
    saveErrorsToFile(
      JSON.stringify(failedResults),
      `.snyk-debug/${Date.now()}.projects-failed-to-inspect-dependencies.log`,
    );
  }

  return {
    plugin: {
      name: 'custom-auto-detect',
    },
    scannedProjects: allResults,
  };
}
