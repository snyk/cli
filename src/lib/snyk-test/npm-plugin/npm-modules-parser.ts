import * as path from 'path';
import * as snyk from '../../index';
import * as spinner from '../../spinner';
import * as analytics from '../../analytics';
import * as fs from 'then-fs';
import {PkgTree} from 'snyk-nodejs-lockfile-parser';

export async function parse(root, targetFile, options): Promise<PkgTree> {
  const nodeModulesPath = path.join(
    path.dirname(path.resolve(root, targetFile)),
    'node_modules',
  );

  if (!fs.existsSync(nodeModulesPath)) {
    // throw a custom error
    throw new Error('Missing node_modules folder: we can\'t test ' +
      `without dependencies.\nPlease run '${options.packageManager} install' first.`);
  }
  analytics.add('local', true);
  analytics.add('generating-node-dependency-tree', {
    lockFile: false,
    targetFile,
  });
  options.root = root;
  const resolveModuleSpinnerLabel = 'Analyzing npm dependencies for ' +
    path.dirname(path.resolve(root, targetFile));
  try {
    await spinner(resolveModuleSpinnerLabel);
    if (targetFile.endsWith('yarn.lock')) {
      options.file = options.file.replace('yarn.lock', 'package.json');
    }

    // package-lock.json falls back to package.json (used in wizard code)
    if (targetFile.endsWith('package-lock.json')) {
      options.file = options.file.replace('package-lock.json', 'package.json');
    }
    return snyk.modules(
      root, Object.assign({}, options, {noFromArrays: true}));
  } finally {
    spinner.clear(resolveModuleSpinnerLabel)();
  }
}
