import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import detect = require('../../lib/detect');
import { TestOptions } from '../types';
import { Options } from '../types';
import { NoSupportedManifestsFoundError } from '../errors';
import { find } from '../find-files';
import { AUTO_DETECTABLE_FILES } from '../detect';
import { getSinglePluginResult } from '../plugins/get-single-plugin-result';
import { getMultiPluginResult } from '../plugins/get-multi-plugin-result';

// tslint:disable-next-line:no-var-requires
const debug = require('debug')('snyk');

// Force getDepsFromPlugin to return scannedProjects for processing
export async function getDepsFromPlugin(
  root: string,
  options: Options & TestOptions,
): Promise<pluginApi.MultiProjectResult> {
  let inspectRes: pluginApi.InspectResult;

  if (options.allProjects) {
    // auto-detect only one-level deep for now
    const targetFiles = await find(root, [], AUTO_DETECTABLE_FILES, 1);
    debug(
      `auto detect manifest files, found ${targetFiles.length}`,
      targetFiles,
    );
    if (targetFiles.length === 0) {
      throw NoSupportedManifestsFoundError([root]);
    }
    inspectRes = await getMultiPluginResult(root, options, targetFiles);
    return inspectRes;
  } else {
    // TODO: is this needed for the auto detect handling above?
    // don't override options.file if scanning multiple files at once
    if (!options.scanAllUnmanaged) {
      options.file = options.file || detect.detectPackageFile(root);
    }
    if (!options.docker && !(options.file || options.packageManager)) {
      throw NoSupportedManifestsFoundError([...root]);
    }
    inspectRes = await getSinglePluginResult(root, options);
  }
  if (!pluginApi.isMultiResult(inspectRes)) {
    if (!inspectRes.package) {
      // something went wrong if both are not present...
      throw Error(
        `error getting dependencies from ${options.packageManager} ` +
          "plugin: neither 'package' nor 'scannedProjects' were found",
      );
    }
    if (!inspectRes.package.targetFile && inspectRes.plugin) {
      inspectRes.package.targetFile = inspectRes.plugin.targetFile;
    }
    // We are using "options" to store some information returned from plugin that we need to use later,
    // but don't want to send to Registry in the Payload.
    // TODO(kyegupov): decouple inspect and payload so that we don't need this hack
    if (
      inspectRes.plugin.meta &&
      inspectRes.plugin.meta.allSubProjectNames &&
      inspectRes.plugin.meta.allSubProjectNames.length > 1
    ) {
      options.advertiseSubprojectsCount =
        inspectRes.plugin.meta.allSubProjectNames.length;
    }
    return {
      plugin: inspectRes.plugin,
      scannedProjects: [{ depTree: inspectRes.package }],
    };
  } else {
    // We are using "options" to store some information returned from plugin that we need to use later,
    // but don't want to send to Registry in the Payload.
    // TODO(kyegupov): decouple inspect and payload so that we don't need this hack
    (options as any).projectNames = inspectRes.scannedProjects.map(
      (scannedProject) => scannedProject.depTree.name,
    );
    return inspectRes;
  }
}
