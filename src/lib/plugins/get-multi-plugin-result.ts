import * as _ from 'lodash';
import * as path from 'path';
import * as cliInterface from '@snyk/cli-interface';

import { TestOptions, Options, MonitorOptions } from '../types';
import { detectPackageManagerFromFile } from '../detect';
import { SupportedPackageManagers } from '../package-managers';
import { getSinglePluginResult } from './get-single-plugin-result';

export interface ScannedProjectCustom
  extends cliInterface.legacyCommon.ScannedProject {
  packageManager: SupportedPackageManagers;
}

export async function getMultiPluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFiles: string[],
): Promise<cliInterface.legacyPlugin.MultiProjectResult> {
  const allResults: ScannedProjectCustom[] = [];
  for (const targetFile of targetFiles) {
    const optionsClone = _.cloneDeep(options);
    optionsClone.file = path.basename(targetFile);
    optionsClone.packageManager = detectPackageManagerFromFile(
      optionsClone.file,
    );
    try {
      const inspectRes = await getSinglePluginResult(
        root,
        optionsClone,
        targetFile,
      );
      let resultWithScannedProjects: cliInterface.legacyPlugin.MultiProjectResult;

      if (!cliInterface.legacyPlugin.isMultiResult(inspectRes)) {
        resultWithScannedProjects = {
          plugin: inspectRes.plugin,
          scannedProjects: [
            {
              depTree: inspectRes.package,
              targetFile: inspectRes.plugin.targetFile,
              meta: inspectRes.meta,
            },
          ],
        };
      } else {
        resultWithScannedProjects = inspectRes;
      }

      // annotate the package manager, project name & targetFile to be used
      // for test & monitor
      // TODO: refactor how we display meta to not have to do this
      (options as any).projectNames = resultWithScannedProjects.scannedProjects.map(
        (scannedProject) => scannedProject.depTree.name,
      );
      const customScannedProject: ScannedProjectCustom[] = resultWithScannedProjects.scannedProjects.map(
        (a) => {
          (a as ScannedProjectCustom).targetFile = optionsClone.file;
          (a as ScannedProjectCustom).packageManager = optionsClone.packageManager!;
          return a as ScannedProjectCustom;
        },
      );
      allResults.push(...customScannedProject);
    } catch (err) {
      console.log(err);
    }
  }

  return {
    plugin: {
      name: 'custom-auto-detect',
    },
    scannedProjects: allResults,
  };
}
