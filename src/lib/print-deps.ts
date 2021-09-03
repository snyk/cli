import config from './config';
import * as depGraphLib from '@snyk/dep-graph';
import { DepDict, Options, MonitorOptions } from './types';
import { legacyCommon as legacyApi } from '@snyk/cli-interface';
import { countPathsToGraphRoot } from './utils';
import { jsonStringifyLargeObject } from './json';

export async function maybePrintDepGraph(
  options: Options | MonitorOptions,
  depGraph: depGraphLib.DepGraph,
) {
  // TODO @boost: remove this logic once we get a valid depGraph print format
  const graphPathsCount = countPathsToGraphRoot(depGraph);
  const hasTooManyPaths = graphPathsCount > config.PRUNE_DEPS_THRESHOLD;

  if (!hasTooManyPaths) {
    const depTree = (await depGraphLib.legacy.graphToDepTree(
      depGraph,
      depGraph.pkgManager.name,
    )) as legacyApi.DepTree;
    maybePrintDepTree(options, depTree);
  } else {
    if (options['print-deps']) {
      if (options.json) {
        console.warn(
          '--print-deps --json option not yet supported for large projects. Displaying graph json output instead',
        );
        // TODO @boost: add as output graphviz 'dot' file to visualize?
        console.log(jsonStringifyLargeObject(depGraph.toJSON()));
      } else {
        console.warn(
          '--print-deps option not yet supported for large projects. Try with --json.',
        );
      }
    }
  }
}

// This option is still experimental and might be deprecated.
// It might be a better idea to convert it to a command (i.e. do not perform test/monitor).
export function maybePrintDepTree(
  options: Options | MonitorOptions,
  rootPackage: legacyApi.DepTree,
) {
  if (options['print-deps']) {
    if (options.json) {
      // Will produce 2 JSON outputs, one for the deps, one for the vuln scan.
      console.log(jsonStringifyLargeObject(rootPackage));
    } else {
      printDepsForTree({ [rootPackage.name!]: rootPackage });
    }
  }
}

function printDepsForTree(depDict: DepDict, prefix = '') {
  let counter = 0;
  const keys = Object.keys(depDict);
  for (const name of keys) {
    const dep = depDict[name];
    let branch = '├─ ';
    const last = counter === keys.length - 1;
    if (last) {
      branch = '└─ ';
    }
    console.log(
      prefix +
        (prefix ? branch : '') +
        dep.name +
        ' @ ' +
        (dep.version ? dep.version : ''),
    );
    if (dep.dependencies) {
      printDepsForTree(dep.dependencies, prefix + (last ? '   ' : '│  '));
    }
    counter++;
  }
}
