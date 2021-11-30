import fs from 'fs';
import pathLib from 'path';

export function readFileHelper(workspacesPath: string, path: string): string {
  // because we write multiple time the file
  // may be have already been updated in fixed-* name
  // so try read that first
  const res = pathLib.parse(path);
  const fixedPath = pathLib.resolve(
    workspacesPath,
    res.dir,
    `fixed-${res.base}`,
  );
  let file;
  try {
    file = fs.readFileSync(fixedPath, 'utf-8');
  } catch (e) {
    file = fs.readFileSync(pathLib.resolve(workspacesPath, path), 'utf-8');
  }
  return file;
}
