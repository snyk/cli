import { MonitorMeta } from '../../../lib/types';
import config from '../../../lib/config';

export function getSCAProjectName(projectDeps): string {
  return (
    projectDeps.meta?.gradleProjectName ||
    projectDeps.depGraph?.rootPkg?.name ||
    projectDeps.depTree?.name
  );
}

// This is used instead of `let x; try { x = await ... } catch { cleanup }` to avoid
// declaring the type of x as possibly undefined.
export async function promiseOrCleanup<T>(
  p: Promise<T>,
  cleanup: (x?) => void,
): Promise<T> {
  return p.catch((error) => {
    cleanup();
    throw error;
  });
}

export function generateMonitorMeta(options, packageManager?): MonitorMeta {
  return {
    method: 'cli',
    packageManager,
    'policy-path': options['policy-path'],
    'project-name': options['project-name'] || config.PROJECT_NAME,
    isDocker: !!options.docker,
    prune: !!options.pruneRepeatedSubdependencies,
    'remote-repo-url': options['remote-repo-url'],
    targetReference: options['target-reference'],
    assetsProjectName: options['assets-project-name'],
  };
}
