import pathLib from 'path';
import { Identity } from '../../types';

export function formatDisplayName(
  path: string,
  identity: Pick<Identity, 'type' | 'targetFile'>,
): string {
  if (!identity.targetFile) {
    return `${identity.type} project`;
  }
  // show paths relative to where `snyk fix` is running
  return pathLib.relative(
    process.cwd(),
    pathLib.join(path, identity.targetFile),
  );
}
