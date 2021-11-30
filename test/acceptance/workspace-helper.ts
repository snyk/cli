import path from 'path';
import { readFileSync } from 'fs';

const workspacePath = path.join(__dirname, 'workspaces');

export function chdirWorkspaces(subdir = '') {
  const dir = path.join(workspacePath, subdir);
  process.chdir(dir);
}

export function getWorkspaceJSON(...paths: string[]): any {
  const filePath = path.join(workspacePath, ...paths);
  try {
    const fileContents = readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (err) {
    throw new Error('Could not read json file: ' + filePath);
  }
}
