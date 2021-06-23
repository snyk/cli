import * as pathLib from 'path';

import { isLocalFolder } from '../../../lib/detect';

export function getDisplayPath(path: string): string {
  if (!isLocalFolder(path)) {
    return path;
  }
  if (path === process.cwd()) {
    return pathLib.parse(path).name;
  }
  return pathLib.relative(process.cwd(), path);
}
