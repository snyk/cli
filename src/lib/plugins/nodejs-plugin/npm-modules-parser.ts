import * as path from 'path';
import * as fs from 'fs';
import * as resolveNodeDeps from 'snyk-resolve-deps';
import * as baseDebug from 'debug';
const isEmpty = require('lodash.isempty');

import * as spinner from '../../spinner';
import * as analytics from '../../analytics';
import { Options } from '../types';
import { getFileContents } from '../../get-file-contents';

const debug = baseDebug('snyk-nodejs-plugin');

export async function parse(
  root: string,
  targetFile: string,
  options: Options,
): Promise<resolveNodeDeps.PackageExpanded> {
  if (targetFile.endsWith('yarn.lock')) {
    options.file =
      options.file && options.file.replace('yarn.lock', 'package.json');
  }

  // package-lock.json falls back to package.json (used in wizard code)
  if (targetFile.endsWith('package-lock.json')) {
    options.file =
      options.file && options.file.replace('package-lock.json', 'package.json');
  }
  // check if there any dependencies
  const packageJsonFileName = path.resolve(root, options.file!);
  const packageManager = options.packageManager || 'npm';

  try {
    const packageJson = JSON.parse(
      getFileContents(root, packageJsonFileName).content,
    );

    let dependencies = packageJson.dependencies;
    if (options.dev) {
      dependencies = { ...dependencies, ...packageJson.devDependencies };
    }
    if (isEmpty(dependencies)) {
      return new Promise((resolve) =>
        resolve({
          name: packageJson.name || 'package.json',
          dependencies: {},
          version: packageJson.version,
        }),
      );
    }
  } catch (e) {
    debug(`Failed to read ${packageJsonFileName}: Error: ${e}`);
    throw new Error(
      `Failed to read ${packageJsonFileName}. Error: ${e.message}`,
    );
  }
  const nodeModulesPath = path.join(
    path.dirname(path.resolve(root, targetFile)),
    'node_modules',
  );

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
    await spinner.clear<void>(resolveModuleSpinnerLabel)();
    await spinner(resolveModuleSpinnerLabel);
    return resolveNodeDeps(
      root,
      Object.assign({}, options, { noFromArrays: true }),
    );
  } finally {
    await spinner.clear<void>(resolveModuleSpinnerLabel)();
  }
}
