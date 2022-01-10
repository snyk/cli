import * as path from 'path';

/**
 * Gets the path to a workspace.
 *
 * Use createProjectFromWorkspace instead to avoid modifying the same path as
 * other tests. Only use this when createProject is unfeasible.
 */
export function getWorkspacePath(name: string): string {
  return path.join(__dirname, '../../acceptance/workspaces', name);
}
