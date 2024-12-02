import config from './config';
import * as depGraphLib from '@snyk/dep-graph';
import { DepDict, Options, MonitorOptions } from './types';
import { legacyCommon as legacyApi } from '@snyk/cli-interface';
import { countPathsToGraphRoot } from './utils';

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
    if (options['print-deps'] && !options.json) {
      // don't print a warning when --json is being used, it can invalidate the JSON output
      console.warn(
        '--print-deps option not yet supported for large projects. Try with --json.',
      );
    }
  }
}

// This option is still experimental and might be deprecated.
// It might be a better idea to convert it to a command (i.e. do not perform test/monitor).
export function maybePrintDepTree(
  options: Options | MonitorOptions,
  rootPackage: legacyApi.DepTree,
) {
  if (options['print-deps'] && !options.json) {
    // only print human readable output tree if NOT using --json
    // to ensure this output does not invalidate JSON output
    printDepsForTree({ [rootPackage.name!]: rootPackage });
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
