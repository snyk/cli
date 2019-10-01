import * as path from 'path';
import { Files, tryGetSpec } from './try-get-spec';
import { Spec } from './index';

const pattern = /^Gemfile(\.lock)*$/;

export function canHandle(file: string): boolean {
  return !!file && pattern.test(path.basename(file));
}

export async function gatherSpecs(root: string, target: string): Promise<Spec> {
  const targetName = path.basename(target);
  const targetDir = path.dirname(target);
  const files: Files = {};

  const gemfileLock = await tryGetSpec(
    root,
    path.join(targetDir, 'Gemfile.lock'),
  );

  if (gemfileLock) {
    files.gemfileLock = gemfileLock;
  } else {
    throw new Error(
      "Missing Gemfile.lock file: we can't test " +
        'without dependencies.\nPlease run `bundle install` first.',
    );
  }

  const gemfile = await tryGetSpec(root, path.join(targetDir, 'Gemfile'));

  if (gemfile) {
    files.gemfile = gemfile;
  }

  return {
    packageName: path.basename(root),
    targetFile: path.join(targetDir, targetName),
    files,
  };
}
