import * as path from 'path';
import { tryGetSpec } from './try-get-spec';
import { Spec } from './index';

const pattern = /^Gemfile(\.lock)*$/;

export function canHandle(file: string): boolean {
  return !!file && pattern.test(path.basename(file));
}

export async function gatherSpecs(root: string, target: string): Promise<Spec> {
  const targetName = path.basename(target);
  const targetDir = path.dirname(target);

  const gemfileLock = await tryGetSpec(
    root,
    path.join(targetDir, 'Gemfile.lock'),
  );

  if (gemfileLock) {
    return {
      packageName: path.basename(root),
      targetFile: path.join(targetDir, targetName),
      files: { gemfileLock },
    };
  } else {
    throw new Error(
      "Missing Gemfile.lock file: we can't test " +
        'without dependencies.\nPlease run `bundle install` first.',
    );
  }
}
