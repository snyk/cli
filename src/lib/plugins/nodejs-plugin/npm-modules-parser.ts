import * as path from 'path';
import * as snyk from '../../index';
import { Spinner } from 'cli-spinner';
import * as analytics from '../../analytics';
import * as fs from 'then-fs';
import { PkgTree } from 'snyk-nodejs-lockfile-parser';
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
  const spinner = new Spinner(resolveModuleSpinnerLabel);
  spinner.setSpinnerString('|/-\\');
  try {
    spinner.start();
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
    return snyk.modules(
      root,
      Object.assign({}, options, { noFromArrays: true }),
    );
  } finally {
    await spinner.stop(true);
  }
}
