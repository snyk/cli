const cloneDeep = require('lodash.clonedeep');
import path = require('path');
import * as get from 'lodash.get';
import chalk from 'chalk';
import { detectPackageManager } from '../../../lib/detect';
import { getDepsFromPlugin } from '../../../lib/plugins/get-deps-from-plugin';
import { spinner } from '../../../lib/spinner';
import { MethodArgs } from '../../args';
import { processCommandArgs } from '../process-command-args';
import { ClientSbomCommandResult } from '../types';
import { icon } from '../../../lib/theme';
import * as analytics from '../../../lib/analytics';
import * as Debug from 'debug';
import * as depGraphLib from '@snyk/dep-graph';
import {
  MultiProjectResultCustom,
  ScannedProjectCustom,
} from '../../../lib/plugins/get-multi-plugin-result';
import * as theme from '../../../lib/theme';
import { FailedToRunClientSbomError } from '../../../lib/errors/failed-to-run-client-sbom-error';
import {
  errorMessageWithRetry,
  UnsupportedPackageManagerError,
} from '../../../lib/errors';
import { DepTree } from '../../../lib/types';
import { extractPackageManager } from '../../../lib/plugins/extract-package-manager';
import { isMultiProjectScan } from '../../../lib/is-multi-project-scan';
import {
  SupportedPackageManagers,
  SUPPORTED_PACKAGE_MANAGER_NAME,
} from '../../../lib/package-managers';
import * as cdx from '@cyclonedx/cyclonedx-library';
import { PackageURL } from 'packageurl-js';
import { maybePrintDepGraph } from '../../../lib/print-deps';
import version from '../version';
import { checkOSSPaths } from '../../../lib/check-paths';
import { pruneGraph } from '../../../lib/prune';
import { assert } from 'console';

const debug = Debug('snyk-client-sbom');

function validateProjectType(options, projectType) {
  if (
    !(
      isMultiProjectScan(options) || SUPPORTED_PACKAGE_MANAGER_NAME[projectType]
    )
  ) {
    throw new UnsupportedPackageManagerError(projectType);
  }
}

/**
 * Generate a {@link https://github.com/package-url/purl-spec purl (Package URL)} for a given {@link depGraphLib.PkgInfo}.
 * @param packageManager {@link SupportedPackageManagers} which discovered `dep`
 * @param dep {@link depGraphLib.PkgInfo} package for which purl is to be generated
 * @returns {@link PackageURL} for the given `dep`
 * @see {@link https://github.com/package-url/purl-spec/blob/master/PURL-TYPES.rst PURL Types Specification}
 */
function depToPackageURL(
  packageManager: SupportedPackageManagers,
  dep: depGraphLib.PkgInfo,
): PackageURL {
  let namespace: string | undefined = undefined;
  let name = dep.name;
  let type: string;
  switch (packageManager) {
    case 'rubygems':
      type = 'gem';
      break;
    case 'npm':
    case 'yarn':
      type = 'npm';
      break;
    case 'maven':
    case 'gradle':
    case 'sbt': {
      const splitName = dep.name.split(':', 2);
      if (splitName.length == 1) {
        namespace = undefined;
        name = splitName[0];
      } else {
        [namespace, name] = splitName;
      }
      type = 'maven';
      break;
    }
    case 'pip':
    case 'poetry':
      type = 'pypi';
      break;
    case 'golangdep':
    case 'gomodules':
    case 'govendor':
      type = 'golang';
      break;
    case 'nuget':
    case 'paket':
      type = 'nuget';
      break;
    case 'composer':
      type = 'composer';
      break;
    case 'cocoapods':
      type = 'carthage';
      break;
    case 'hex':
      type = 'hex';
      break;
    case 'Unmanaged (C/C++)':
      type = 'generic';
      break;
    case 'swift':
      type = 'swift';
      break;
    default: {
      const exhaustiveCheck: never = packageManager;
      throw new Error(`Unhandled packageManager case: ${exhaustiveCheck}`);
    }
  }
  return new PackageURL(
    type,
    namespace,
    name,
    dep.version,
    undefined,
    undefined,
  );
}

/**
 * Create and add a {@link cdx.Models.Component} for the given {@link depGraphLib.PkgInfo} to the given {@link cdx.Models.Bom} if it hasn't already been created.
 * @param dep the dep to add to `bom`
 * @param packageURLToComponent map used to determine if a {@link cdx.Models.Component} has been previously created. Used to determine if a new {@link cdx.Models.Component} should be created or if an existing one should be used.
 * @param packageManager {@link SupportedPackageManagers} which constructed `depGraph`
 * @param targetFile path to the file from which the `depGraph` was derived.
 * @param bom {@link cdx.Models.Bom} to which to add the component.
 * @param depGraph {@link depGraphLib.DepGraph} that contains `dep`
 * @returns the {@link cdx.Models.Component} representation of `dep`
 */
function component(
  dep: depGraphLib.PkgInfo,
  packageURLToComponent: Map<string, cdx.Models.Component>,
  packageManager: SupportedPackageManagers,
  targetFile: string,
  bom: cdx.Models.Bom,
  depGraph: depGraphLib.DepGraph,
): cdx.Models.Component {
  const packageURL = depToPackageURL(packageManager, dep);
  const packageURLString = packageURL.toString();
  if (!(packageURLString in packageURLToComponent)) {
    const depComponent = new cdx.Models.Component(
      cdx.Enums.ComponentType.Library,
      packageURL.name,
      {
        version: dep.version,
        purl: packageURL,
        group: packageURL.namespace?.toString(),
        bomRef: `${targetFile}:${packageURL}`,
      },
    );
    // The "snyk" property namespace has been reserved: https://github.com/CycloneDX/cyclonedx-property-taxonomy
    depComponent.properties.add(
      new cdx.Models.Property('snyk:package_manager:name', packageManager),
    );
    depComponent.properties.add(
      new cdx.Models.Property('snyk:source_file:path', targetFile),
    );
    packageURLToComponent[packageURLString] = depComponent;
    bom.components.add(depComponent);

    // dependency graph
    if (depGraph.rootPkg !== dep) {
      for (const pathToRoot of depGraph.pkgPathsToRoot(dep)) {
        assert(pathToRoot.length > 1); // pathToRoot is always greater than 1 for non-root packages (and the root package isn't included)
        assert(dep === pathToRoot[0]); // sanity check; the path to root always starts with the given package
        const revDep = pathToRoot[1];
        const revDepComponent = component(
          revDep,
          packageURLToComponent,
          packageManager,
          targetFile,
          bom,
          depGraph,
        );
        revDepComponent.dependencies.add(depComponent.bomRef);
      }
    }
  }
  return packageURLToComponent[packageURLString];
}

export default async (...args: MethodArgs): Promise<ClientSbomCommandResult> => {
  const { options: originalOptions, paths } = processCommandArgs(...args);
  debug(originalOptions);
  checkOSSPaths(paths, originalOptions);
  const humanReadableArr: string[] = [];
  const bom = new cdx.Models.Bom();
  bom.metadata.tools.add(
    new cdx.Models.Tool({
      vendor: 'Snyk',
      name: 'snyk-cli',
      version: await version(),
    }),
  );
  // Promise waterfall to test all other paths sequentially
  for (const root of paths) {
    // Create a copy of the options so a specific test can
    // modify them i.e. add `options.file` etc. We'll need
    // these options later.
    const options = cloneDeep(originalOptions);
    options.path = root;
    if (!options.allProjects) {
      options.packageManager = detectPackageManager(root, options);
    }
    const projectType = options.packageManager;
    validateProjectType(options, projectType);

    // For --all-projects packageManager is yet undefined here. Use 'all'
    let analysisTypeText = 'all dependencies for ';
    if (options.packageManager) {
      analysisTypeText = options.packageManager + ' dependencies for ';
    }

    const spinnerLbl =
      'Analyzing ' +
      analysisTypeText +
      (path.relative('.', path.join(root, options.file || '')) ||
        path.relative('..', '.') + ' project dir');
    try {
      await spinner.clear<void>(spinnerLbl)();
      if (!options.quiet) {
        await spinner(spinnerLbl);
      }

      const deps = await getDepsFromPlugin(root, options);

      const failedResults = (deps as MultiProjectResultCustom).failedResults;
      if (failedResults?.length) {
        await spinner.clear<void>(spinnerLbl)();
        if (!options.json && !options.quiet) {
          console.warn(
            chalk.bold.red(
              `${icon.ISSUE} ${failedResults.length}/${failedResults.length +
                deps.scannedProjects
                  .length} potential projects failed to get dependencies.`,
            ),
          );
          failedResults.forEach((f) => {
            if (f.targetFile) {
              console.warn(theme.color.status.error(`${f.targetFile}:`));
            }
            console.warn(theme.color.status.error(`  ${f.errMessage}`));
          });
        }
        debug(
          'getDepsFromPlugin returned failed results, cannot run deps',
          failedResults,
        );
        if (options['fail-fast']) {
          throw new FailedToRunClientSbomError(
            errorMessageWithRetry('Your deps request could not be completed.'),
          );
        }
      }
      analytics.add('pluginName', deps.plugin.name);
      const javaVersion = get(
        deps.plugin,
        'meta.versionBuildInfo.metaBuildVersion.javaVersion',
        null,
      );
      const mvnVersion = get(
        deps.plugin,
        'meta.versionBuildInfo.metaBuildVersion.mvnVersion',
        null,
      );
      const sbtVersion = get(
        deps.plugin,
        'meta.versionBuildInfo.metaBuildVersion.sbtVersion',
        null,
      );
      if (javaVersion) {
        analytics.add('javaVersion', javaVersion);
      }
      if (mvnVersion) {
        analytics.add('mvnVersion', mvnVersion);
      }
      if (sbtVersion) {
        analytics.add('sbtVersion', sbtVersion);
      }

      for (const scannedProject of deps.scannedProjects) {
        const project = scannedProject as ScannedProjectCustom;
        const packageManager = extractPackageManager(project, deps, options)!;
        const pkg:
          | DepTree
          | depGraphLib.DepGraph
          | undefined = scannedProject.depGraph
          ? scannedProject.depGraph
          : scannedProject.depTree;

        let depGraph: depGraphLib.DepGraph;
        if (scannedProject.depGraph) {
          depGraph = scannedProject.depGraph;
        } else {
          // Graphs are more compact and robust representations.
          // Legacy parts of the code are still using trees, but will eventually be fully migrated.
          debug('converting dep-tree to dep-graph', {
            name: (pkg as DepTree).name,
            targetFile: scannedProject.targetFile || options.file,
          });
          depGraph = await depGraphLib.legacy.depTreeToGraph(
            pkg as DepTree,
            packageManager,
          );
          debug('done converting dep-tree to dep-graph', {
            uniquePkgsCount: depGraph.getDepPkgs().length,
          });
        }
        maybePrintDepGraph(options, depGraph);

        depGraph = await pruneGraph(
          depGraph,
          packageManager,
          options.pruneIsRequired,
        );

        const targetFile = path.relative(
          '.',
          path.resolve(root, scannedProject.targetFile || options.file || '.'),
        );
        humanReadableArr.push(
          `${targetFile}: Found ${depGraph.getPkgs().length} ${
            depGraph.pkgManager.name
          } dependencies`,
        );

        const packageURLToComponent = new Map<string, cdx.Models.Component>();

        for (const dep of depGraph.getPkgs()) {
          component(
            dep,
            packageURLToComponent,
            packageManager,
            targetFile,
            bom,
            depGraph,
          );
        }
      }
    } finally {
      await spinner.clear<void>(spinnerLbl)();
    }
  }
  const cyclonedxJsonResult = new cdx.Serialize.JsonSerializer(
    new cdx.Serialize.JSON.Normalize.Factory(cdx.Spec.Spec1dot4),
  ).serialize(bom);

  return ClientSbomCommandResult.createClientSbomCommandResult(
    originalOptions['cyclonedx-json']
      ? cyclonedxJsonResult
      : humanReadableArr.join('\n'),
    cyclonedxJsonResult,
  );
}
