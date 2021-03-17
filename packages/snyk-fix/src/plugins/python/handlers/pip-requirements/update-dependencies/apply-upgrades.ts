import { Requirement } from './requirements-file-parser';
import { UpgradedRequirements } from './types';

export function applyUpgrades(
  originalRequirements: Requirement[],
  upgradedRequirements: UpgradedRequirements,
): string[] {
  const updated: string[] = [];
  for (const requirement of originalRequirements) {
    const { originalText } = requirement;
    if (upgradedRequirements[originalText]) {
      updated.push(upgradedRequirements[originalText]);
    } else {
      updated.push(originalText);
    }
  }
  return updated;
}
