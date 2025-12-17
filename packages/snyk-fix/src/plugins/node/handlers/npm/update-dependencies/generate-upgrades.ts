import * as debugLib from 'debug';
import { EntityToFix } from '../../../../../types';

const debug = debugLib('snyk-fix:node:npm:generate-upgrades');

export interface UpgradeInfo {
  /**
   * Package name
   */
  name: string;
  /**
   * Current version installed
   */
  currentVersion: string;
  /**
   * Target version to upgrade to
   */
  targetVersion: string;
  /**
   * Issue IDs that this upgrade addresses
   */
  issueIds: string[];
}

/**
 * Extract upgrade information from remediation.upgrade.
 * This contains direct dependency upgrades that fix vulnerabilities.
 */
export async function generateUpgrades(
  entity: EntityToFix,
): Promise<UpgradeInfo[]> {
  const { remediation } = entity.testResult;

  if (!remediation) {
    debug('No remediation data available');
    return [];
  }

  const upgrades: UpgradeInfo[] = [];

  // Process direct upgrades from remediation.upgrade
  const { upgrade } = remediation;
  if (upgrade && Object.keys(upgrade).length > 0) {
    for (const [fromPkgAtVersion, upgradeData] of Object.entries(upgrade)) {
      const [name, currentVersion] = parsePackageAtVersion(fromPkgAtVersion);
      const targetVersion = parseTargetVersion(upgradeData.upgradeTo);

      if (!name || !targetVersion) {
        debug(`Skipping invalid upgrade entry: ${fromPkgAtVersion}`);
        continue;
      }

      upgrades.push({
        name,
        currentVersion: currentVersion || 'unknown',
        targetVersion,
        issueIds: upgradeData.vulns || [],
      });
    }
  }

  // Deduplicate by package name (keep the one with most issue IDs)
  const deduped = deduplicateUpgrades(upgrades);

  debug(`Generated ${deduped.length} upgrades from remediation data`);
  return deduped;
}

/**
 * Deduplicate upgrades by package name.
 * If multiple upgrades target the same package, merge their issueIds.
 */
function deduplicateUpgrades(upgrades: UpgradeInfo[]): UpgradeInfo[] {
  const byName = new Map<string, UpgradeInfo>();

  for (const upgrade of upgrades) {
    const key = `${upgrade.name}@${upgrade.targetVersion}`;
    const existing = byName.get(key);

    if (existing) {
      // Merge issue IDs
      const mergedIssueIds = [
        ...new Set([...existing.issueIds, ...upgrade.issueIds]),
      ];
      existing.issueIds = mergedIssueIds;
    } else {
      byName.set(key, { ...upgrade });
    }
  }

  return Array.from(byName.values());
}

/**
 * Parse a package@version string into [name, version]
 */
function parsePackageAtVersion(pkgAtVersion: string): [string, string | null] {
  // Handle scoped packages like @scope/package@1.0.0
  const lastAtIndex = pkgAtVersion.lastIndexOf('@');

  if (lastAtIndex <= 0) {
    // No @ found or @ is at position 0 (scoped package without version)
    return [pkgAtVersion, null];
  }

  const name = pkgAtVersion.substring(0, lastAtIndex);
  const version = pkgAtVersion.substring(lastAtIndex + 1);

  return [name, version];
}

/**
 * Parse the target version from upgradeTo string (format: name@version)
 */
function parseTargetVersion(upgradeTo: string): string | null {
  const [, version] = parsePackageAtVersion(upgradeTo);
  return version;
}

