import {
  DependencyPins,
  FixChangesError,
  FixChangesSuccess,
  FixChangesSummary,
} from '../../../../../types';

export function generateFailedChanges(
  attemptedUpdates: string[],
  pins: DependencyPins,
  error: Error,
  command?: string,
): FixChangesError[] {
  const changes: FixChangesError[] = [];
  for (const pkgAtVersion of Object.keys(pins)) {
    const pin = pins[pkgAtVersion];
    if (
      !attemptedUpdates
        .map((update) => update.replace('==', '@'))
        .includes(pin.upgradeTo)
    ) {
      continue;
    }
    const updatedMessage = pin.isTransitive ? 'pin' : 'upgrade';
    const newVersion = pin.upgradeTo.split('@')[1];
    const [pkgName, version] = pkgAtVersion.split('@');

    changes.push({
      success: false,
      reason: error.message,
      userMessage: `Failed to ${updatedMessage} ${pkgName} from ${version} to ${newVersion}`,
      tip: command ? `Try running \`${command}\`` : undefined,
      issueIds: pin.vulns,
      from: pkgAtVersion,
      to: `${pkgName}@${newVersion}`,
    });
  }
  return changes;
}

export function generateSuccessfulChanges(
  appliedUpgrades: string[],
  pins: DependencyPins,
): FixChangesSuccess[] {
  const changes: FixChangesSuccess[] = [];
  for (const pkgAtVersion of Object.keys(pins)) {
    const pin = pins[pkgAtVersion];
    if (
      !appliedUpgrades
        .map((upgrade) => upgrade.replace('==', '@'))
        .includes(pin.upgradeTo)
    ) {
      continue;
    }
    const updatedMessage = pin.isTransitive ? 'Pinned' : 'Upgraded';
    const newVersion = pin.upgradeTo.split('@')[1];
    const [pkgName, version] = pkgAtVersion.split('@');

    changes.push({
      success: true,
      userMessage: `${updatedMessage} ${pkgName} from ${version} to ${newVersion}`,
      issueIds: pin.vulns,
      from: pkgAtVersion,
      to: `${pkgName}@${newVersion}`,
    });
  }
  return changes;
}

export function isSuccessfulChange(
  change: FixChangesSummary,
): change is FixChangesError {
  return change.success === true;
}
