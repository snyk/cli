import {
  FixChangesError,
  FixChangesSuccess,
  FixChangesSummary,
} from '../../../types';
import { UpgradeInfo } from './npm/update-dependencies/generate-upgrades';

export function generateFailedChanges(
  attemptedUpgrades: UpgradeInfo[],
  error: Error,
  command?: string,
): FixChangesError[] {
  const changes: FixChangesError[] = [];

  for (const upgrade of attemptedUpgrades) {
    changes.push({
      success: false,
      reason: error.message,
      userMessage: `Failed to upgrade ${upgrade.name} from ${upgrade.currentVersion} to ${upgrade.targetVersion}`,
      tip: command ? `Try running \`${command}\`` : undefined,
      issueIds: upgrade.issueIds,
      from: `${upgrade.name}@${upgrade.currentVersion}`,
      to: `${upgrade.name}@${upgrade.targetVersion}`,
    });
  }

  return changes;
}

export function generateSuccessfulChanges(
  appliedUpgrades: UpgradeInfo[],
): FixChangesSuccess[] {
  const changes: FixChangesSuccess[] = [];

  for (const upgrade of appliedUpgrades) {
    changes.push({
      success: true,
      userMessage: `Upgraded ${upgrade.name} from ${upgrade.currentVersion} to ${upgrade.targetVersion}`,
      issueIds: upgrade.issueIds,
      from: `${upgrade.name}@${upgrade.currentVersion}`,
      to: `${upgrade.name}@${upgrade.targetVersion}`,
    });
  }

  return changes;
}

export function isSuccessfulChange(
  change: FixChangesSummary,
): change is FixChangesSuccess {
  return change.success === true;
}

