import { DependencyPins, DependencyUpdates, TestResult } from '../../types';

export function hasFixableIssues(
  results: TestResult[],
): {
  hasFixes: boolean;
  count: number;
} {
  let hasFixes = false;
  let count = 0;
  for (const result of Object.values(results)) {
    const { remediation } = result;
    if (remediation) {
      const { upgrade, pin, patch } = remediation;
      const upgrades = Object.keys(upgrade);
      const pins = Object.keys(pin);
      if (pins.length || upgrades.length) {
        hasFixes = true;
        // pins & upgrades are mutually exclusive
        count += getUpgradableIssues(pins.length ? pin : upgrade);
      }
      const patches = Object.keys(patch);
      if (patches.length) {
        hasFixes = true;
        count += patches.length;
      }
    }
  }

  return {
    hasFixes,
    count,
  };
}

function getUpgradableIssues(
  updates: DependencyUpdates | DependencyPins,
): number {
  const issues: string[] = [];
  for (const id of Object.keys(updates)) {
    issues.push(...updates[id].vulns);
  }

  return issues.length;
}
