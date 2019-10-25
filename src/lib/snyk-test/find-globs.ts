import * as fs from 'then-fs';
import * as pathLib from 'path';
import { getAllSupportedManifestFiles } from './project-types';


export function fileExists(root, file) {
  return file && fs.existsSync(root) &&
    fs.existsSync(pathLib.resolve(root, file));
}

export function findGlobs(searchPath: string): string[] {
  const manifestFiles = getAllSupportedManifestFiles();
  const foundManifests: string[] = [];
  for (const file of manifestFiles) {
    if (fileExists(searchPath, file)) {
      foundManifests.push(file);
    }
  }
  return foundManifests;
}

export function getSearchPath() {
  return process.cwd();
}
