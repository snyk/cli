import * as debugLib from 'debug';
import * as path from 'path';
import { npmInstallLockfileOnly } from '@snyk/node-fix';

import {
  EntityToFix,
  FixChangesSummary,
  FixOptions,
  OverrideCandidate,
} from '../../../../../types';

const debug = debugLib('snyk-fix:node:npm:overrides');

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Apply overrides to package.json for transitive dependencies with no upgrade path.
 * This is an opt-in feature enabled with --use-overrides flag.
 *
 * Candidates are pre-computed by is-supported.ts and stored on entity.overrideCandidates
 *
 * @param entity - The entity to fix (with overrideCandidates already computed)
 * @param options - Fix options
 * @returns Array of fix change summaries
 */
export async function applyOverrides(
  entity: EntityToFix,
  options: FixOptions,
): Promise<FixChangesSummary[]> {
  const overrides = entity.overrideCandidates || [];
  if (overrides.length === 0) {
    return [];
  }

  const changes: FixChangesSummary[] = [];
  const projectPath = getProjectPath(entity);

  debug(`Applying ${overrides.length} overrides to package.json`);

  if (options.dryRun) {
    debug('Dry run - skipping actual override application');
    return overrides.map((override) => ({
      success: true,
      userMessage: `Would add override for ${override.name}@${override.targetVersion}`,
      issueIds: override.issueIds,
    }));
  }

  try {
    // Read current package.json (relative to project directory)
    const targetFile = entity.scanResult.identity.targetFile || '';
    const projectDir = path.dirname(targetFile);
    const packageJsonPath = projectDir ? path.join(projectDir, 'package.json') : 'package.json';
    const packageJsonContent = await entity.workspace.readFile(packageJsonPath);
    const packageJson: PackageJson = JSON.parse(packageJsonContent);

    // Add or update overrides
    if (!packageJson.overrides) {
      packageJson.overrides = {};
    }

    for (const override of overrides) {
      packageJson.overrides[override.name] = override.targetVersion;
      debug(`Added override: ${override.name} -> ${override.targetVersion}`);
    }

    // Write updated package.json
    await entity.workspace.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n',
    );

    // Run npm install to regenerate lockfile with overrides
    debug('Running npm install to apply overrides');
    const result = await npmInstallLockfileOnly(projectPath);

    if (result.exitCode === 0) {
      debug('npm install succeeded after applying overrides');
      changes.push(
        ...overrides.map((override) => ({
          success: true as const,
          userMessage: `Added override for ${override.name}@${override.targetVersion}`,
          issueIds: override.issueIds,
        })),
      );
    } else {
      debug(`npm install failed with exit code ${result.exitCode}`);
      changes.push(
        ...overrides.map((override) => ({
          success: false as const,
          reason:
            result.stderr ||
            `npm install failed with exit code ${result.exitCode}`,
          userMessage: `Failed to apply override for ${override.name}@${override.targetVersion}`,
          issueIds: override.issueIds,
        })),
      );
    }
  } catch (error) {
    debug('Error applying overrides:', error);
    changes.push(
      ...overrides.map((override) => ({
        success: false as const,
        reason: (error as Error).message,
        userMessage: `Failed to apply override for ${override.name}@${override.targetVersion}`,
        issueIds: override.issueIds,
      })),
    );
  }

  return changes;
}

function getProjectPath(entity: EntityToFix): string {
  const workspacePath = entity.workspace.path;
  const targetFile = entity.scanResult.identity.targetFile || '';

  if (
    targetFile.endsWith('package-lock.json') ||
    targetFile.endsWith('package.json')
  ) {
    return path.join(workspacePath, path.dirname(targetFile));
  }

  return workspacePath;
}

