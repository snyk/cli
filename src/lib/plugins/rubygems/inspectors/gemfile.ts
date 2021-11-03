import * as path from 'path';
import { tryGetSpec } from './try-get-spec';
import { Spec } from './index';
import * as types from '../../types';

/* Supported example patterns:
 * Gemfile
 * Gemfile.lock
 * rails.2.4.5.gemfile
 * rails.2.4.5.gemfile.lock
 * gemfiles/Gemfile.rails-2.4.5.lock
 * gemfiles/Gemfile.lock.rails-2.4.5
 */

const gemfileOrLockfilePattern = /.*[gG]emfile.*(\.lock)?.*$/;
const gemfileLockPattern = /.*[gG]emfile.*(\.lock).*$/;

export function canHandle(file: string): boolean {
  return !!file && gemfileOrLockfilePattern.test(path.basename(file));
}

export async function gatherSpecs(
  root: string,
  target: string,
  options: types.Options,
): Promise<Spec> {
  const { dir, name } = path.parse(target);
  const isGemfileLock = gemfileLockPattern.test(target);
  // if the target is a Gemfile we treat is as the lockfile
  const gemfileLock = await tryGetSpec(
    root,
    isGemfileLock ? target : path.join(target + '.lock'),
  );

  if (gemfileLock) {
    const basePackageName = path.basename(root);
    return {
      packageName: options.allSubProjects
        ? path.join(basePackageName, dir)
        : basePackageName,
      targetFile: path.join(dir, name),
      files: { gemfileLock },
    };
  } else {
    throw new Error(
      `Could not read ${target || 'Gemfile.lock'} lockfile: can't test ` +
        'without dependencies.\nPlease run `bundle install` first or' +
        ' if this is a custom file name re-run with --file=path/to/custom.gemfile.lock --package-manager=rubygems',
    );
  }
}
