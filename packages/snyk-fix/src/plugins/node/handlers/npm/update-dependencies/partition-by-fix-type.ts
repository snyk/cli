import * as debugLib from 'debug';
import * as semver from 'semver';
import * as fs from 'fs';
import * as path from 'path';

import { EntityToFix } from '../../../../../types';
import { UpgradeInfo } from './generate-upgrades';

const debug = debugLib('snyk-fix:node:npm:partition');

export interface PartitionedUpgrades {
  /**
   * Packages that can be updated within the existing semver range.
   * These will use `npm update pkg1 pkg2 ...`
   */
  withinRange: UpgradeInfo[];
  /**
   * Packages that require changing the semver range in package.json.
   * These will use `npm install pkg1@version1 pkg2@version2 ...`
   */
  outsideRange: UpgradeInfo[];
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class PackageJsonReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackageJsonReadError';
  }
}

/**
 * Partition upgrades into those that can be done via `npm update` (within semver range)
 * and those that require `npm install pkg@version` (outside semver range).
 *
 * @throws {PackageJsonReadError} if package.json cannot be read
 */
export async function partitionByFixType(
  entity: EntityToFix,
  upgrades: UpgradeInfo[],
): Promise<PartitionedUpgrades> {
  const result: PartitionedUpgrades = {
    withinRange: [],
    outsideRange: [],
  };

  // Read package.json to get current dependency ranges
  const packageJson = await readPackageJson(entity);

  if (!packageJson) {
    throw new PackageJsonReadError(
      'Could not read package.json - cannot determine fix strategy',
    );
  }

  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const upgrade of upgrades) {
    const currentRange = allDependencies[upgrade.name];

    if (!currentRange) {
      // Package not found in dependencies - might be transitive
      // Treat as outside range (will need npm install)
      debug(
        `Package ${upgrade.name} not found in package.json dependencies, treating as outside range`,
      );
      result.outsideRange.push(upgrade);
      continue;
    }

    // Check if target version satisfies current semver range
    const satisfies = semver.satisfies(upgrade.targetVersion, currentRange);

    if (satisfies) {
      debug(
        `${upgrade.name}@${upgrade.targetVersion} satisfies current range "${currentRange}", using npm update`,
      );
      result.withinRange.push(upgrade);
    } else {
      debug(
        `${upgrade.name}@${upgrade.targetVersion} does not satisfy current range "${currentRange}", using npm install`,
      );
      result.outsideRange.push(upgrade);
    }
  }

  debug(
    `Partitioned ${upgrades.length} upgrades: ${result.withinRange.length} within range, ${result.outsideRange.length} outside range`,
  );

  return result;
}

async function readPackageJson(entity: EntityToFix): Promise<PackageJson | null> {
  try {
    const workspacePath = entity.workspace.path;
    const targetFile = entity.scanResult.identity.targetFile || '';

    // Determine package.json path
    let packageJsonPath: string;

    if (targetFile.endsWith('package-lock.json')) {
      packageJsonPath = path.join(
        workspacePath,
        path.dirname(targetFile),
        'package.json',
      );
    } else if (targetFile.endsWith('package.json')) {
      packageJsonPath = path.join(workspacePath, targetFile);
    } else {
      packageJsonPath = path.join(workspacePath, 'package.json');
    }

    const content = await entity.workspace.readFile(
      path.relative(workspacePath, packageJsonPath),
    );
    return JSON.parse(content) as PackageJson;
  } catch (error) {
    debug('Error reading package.json:', error);
    return null;
  }
}

