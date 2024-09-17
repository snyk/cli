import * as path from 'path';
import { readFileSync } from 'fs';

const workspacePath = path.join(__dirname, 'workspaces');

/**
 * Changes the current working directory to the specified subdirectory within the workspace path.
 *
 * @param {string} subdir - The subdirectory to navigate to (optional). If not provided, the workspace path itself will be used.
 *
 * @example
 * chdirWorkspaces('project1'); // Changes the working directory to '${workspacePath}/project1'
 */
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
