import * as debugLib from 'debug';
import * as path from 'path';
import { npmInstall, npmUpdate } from '@snyk/node-fix';

import { EntityToFix, FixChangesSummary, FixOptions } from '../../../../../types';
import { PartitionedUpgrades } from './partition-by-fix-type';
import { UpgradeInfo } from './generate-upgrades';
import {
  generateSuccessfulChanges,
  generateFailedChanges,
} from '../../attempted-changes-summary';

const debug = debugLib('snyk-fix:node:npm:apply-fixes');

/**
 * Apply the partitioned fixes using npm update and npm install.
 */
export async function applyFixes(
  entity: EntityToFix,
  partitioned: PartitionedUpgrades,
  options: FixOptions,
): Promise<FixChangesSummary[]> {
  const changes: FixChangesSummary[] = [];
  const projectPath = getProjectPath(entity);

  // Apply npm update for packages within semver range
  if (partitioned.withinRange.length > 0) {
    const updateChanges = await applyNpmUpdate(
      projectPath,
      partitioned.withinRange,
      options,
    );
    changes.push(...updateChanges);
  }

  // Apply npm install for packages outside semver range
  if (partitioned.outsideRange.length > 0) {
    const installChanges = await applyNpmInstall(
      projectPath,
      partitioned.outsideRange,
      options,
    );
    changes.push(...installChanges);
  }

  return changes;
}

async function applyNpmUpdate(
  projectPath: string,
  upgrades: UpgradeInfo[],
  options: FixOptions,
): Promise<FixChangesSummary[]> {
  const packageNames = upgrades.map((u) => u.name);
  const command = `npm update ${packageNames.join(' ')}`;

  debug(`Running: ${command}`);

  if (options.dryRun) {
    debug('Dry run - skipping actual npm update');
    return generateSuccessfulChanges(upgrades);
  }

  try {
    const result = await npmUpdate(projectPath, packageNames);

    if (result.exitCode === 0) {
      debug('npm update succeeded');
      return generateSuccessfulChanges(upgrades);
    } else {
      debug(`npm update failed with exit code ${result.exitCode}`);
      const error = new Error(
        result.stderr || `npm update failed with exit code ${result.exitCode}`,
      );
      return generateFailedChanges(upgrades, error, command);
    }
  } catch (error) {
    debug('npm update threw an error:', error);
    return generateFailedChanges(upgrades, error as Error, command);
  }
}

async function applyNpmInstall(
  projectPath: string,
  upgrades: UpgradeInfo[],
  options: FixOptions,
): Promise<FixChangesSummary[]> {
  const packageSpecs = upgrades.map((u) => `${u.name}@${u.targetVersion}`);
  const command = `npm install ${packageSpecs.join(' ')}`;

  debug(`Running: ${command}`);

  if (options.dryRun) {
    debug('Dry run - skipping actual npm install');
    return generateSuccessfulChanges(upgrades);
  }

  try {
    const result = await npmInstall(projectPath, packageSpecs);

    if (result.exitCode === 0) {
      debug('npm install succeeded');
      return generateSuccessfulChanges(upgrades);
    } else {
      debug(`npm install failed with exit code ${result.exitCode}`);
      const error = new Error(
        result.stderr || `npm install failed with exit code ${result.exitCode}`,
      );
      return generateFailedChanges(upgrades, error, command);
    }
  } catch (error) {
    debug('npm install threw an error:', error);
    return generateFailedChanges(upgrades, error as Error, command);
  }
}

function getProjectPath(entity: EntityToFix): string {
  const workspacePath = entity.workspace.path;
  const targetFile = entity.scanResult.identity.targetFile || '';

  // Get directory containing the manifest
  if (targetFile.endsWith('package-lock.json') || targetFile.endsWith('package.json')) {
    return path.join(workspacePath, path.dirname(targetFile));
  }

  return workspacePath;
}

