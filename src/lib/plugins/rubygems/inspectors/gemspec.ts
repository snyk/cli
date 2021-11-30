import path from 'path';
import { Files, tryGetSpec } from './try-get-spec';
import { Spec } from './index';

const pattern = /\.gemspec$/;

export function canHandle(file: string): boolean {
  return !!file && pattern.test(file);
}

export async function gatherSpecs(root: string, target: string): Promise<Spec> {
  const targetName = path.basename(target);
  const targetDir = path.dirname(target);
  const files: Files = {};

  const gemspec = await tryGetSpec(root, path.join(targetDir, targetName));

  if (gemspec) {
    files.gemspec = gemspec;
  } else {
    throw new Error(`File not found: ${target}`);
  }

  const gemfileLock = await tryGetSpec(
    root,
    path.join(targetDir, 'Gemfile.lock'),
  );

  if (gemfileLock) {
    files.gemfileLock = gemfileLock;
  }

  return {
    packageName: path.basename(root),
    targetFile: path.join(targetDir, targetName),
    files,
  };
}
