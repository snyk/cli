import * as path from 'path';
import * as fs from 'fs';
import * as resolveNodeDeps from 'snyk-resolve-deps';
import { PkgTree } from 'snyk-nodejs-lockfile-parser';

import * as spinner from '../../spinner';
import * as analytics from '../../analytics';
import { Options } from '../types';

export async function parse(
  root: string,
  targetFile: string,
  options: Options,
): Promise<PkgTree> {
  const nodeModulesPath = path.join(
    path.dirname(path.resolve(root, targetFile)),
    'node_modules',
  );
  const packageManager = options.packageManager || 'npm';

  if (!fs.existsSync(nodeModulesPath)) {
    // throw a custom error
    throw new Error(
      "Missing node_modules folder: we can't test " +
        `without dependencies.\nPlease run '${packageManager} install' first.`,
    );
  }
  analytics.add('local', true);
  analytics.add('generating-node-dependency-tree', {
    lockFile: false,
    targetFile,
  });

  const resolveModuleSpinnerLabel =
    'Analyzing npm dependencies for ' +
    path.dirname(path.resolve(root, targetFile));
  try {
    await spinner(resolveModuleSpinnerLabel);
    if (targetFile.endsWith('yarn.lock')) {
      options.file =
        options.file && options.file.replace('yarn.lock', 'package.json');
    }

    // package-lock.json falls back to package.json (used in wizard code)
    if (targetFile.endsWith('package-lock.json')) {
      options.file =
        options.file &&
        options.file.replace('package-lock.json', 'package.json');
    }
    return resolveNodeDeps(
      root,
      Object.assign({}, options, { noFromArrays: true }),
    );
  } finally {
    await spinner.clear<void>(resolveModuleSpinnerLabel)();
  }
}
