import { DepDict, Options, MonitorOptions, DepTree } from './types';

// This option is still experimental and might be deprecated.
// It might be a better idea to convert it to a command (i.e. do not perform test/monitor).
export function maybePrintDeps(options: Options | MonitorOptions, rootPackage: DepTree) {
  if (options['print-deps']) {
    if (options.json) {
      // Will produce 2 JSON outputs, one for the deps, one for the vuln scan.
      console.log(JSON.stringify(rootPackage, null, 2));
    } else {
      printDeps({[rootPackage.name!]: rootPackage});
    }
  }
}

function printDeps(depDict: DepDict, prefix: string = '') {
  let counter = 0;
  const keys = Object.keys(depDict);
  for (const name of keys) {
    const dep = depDict[name];
    let branch = '├─ ';
    const last = (counter === keys.length - 1);
    if (last) {
      branch = '└─ ';
    }
    console.log(prefix + (prefix ? branch : '') + dep.name + ' @ ' + dep.version);
    if (dep.dependencies) {
      printDeps(dep.dependencies, prefix + (last ? '   ' : '│  '));
    }
    counter++;
  }
}
