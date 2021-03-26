import { DependencyPins, FixChangesSummary } from '../../../../../types';
import { calculateRelevantFixes } from './calculate-relevant-fixes';
import { Requirement } from './requirements-file-parser';
import { UpgradedRequirements } from './types';

export function generateUpgrades(
  requirements: Requirement[],
  updates: DependencyPins,
  referenceFileInChanges?: string,
): {
  updatedRequirements: UpgradedRequirements;
  changes: FixChangesSummary[];
  appliedRemediation: string[];
} {
  // Lowercase the upgrades object. This might be overly defensive, given that
  // we control this input internally, but its a low cost guard rail. Outputs a
  // mapping of upgrade to -> from, instead of the nested upgradeTo object.
  const lowerCasedUpgrades = calculateRelevantFixes(
    requirements,
    updates,
    'direct-upgrades',
  );
  if (Object.keys(lowerCasedUpgrades).length === 0) {
    return {
      updatedRequirements: {},
      changes: [],
      appliedRemediation: [],
    };
  }

  const appliedRemediation: string[] = [];
  const changes: FixChangesSummary[] = [];
  const updatedRequirements = {};
  requirements.map(
    ({
      name,
      originalName,
      versionComparator,
      version,
      originalText,
      extras,
    }) => {
      // Defensive patching; if any of these are undefined, return
      if (
        typeof name === 'undefined' ||
        typeof versionComparator === 'undefined' ||
        typeof version === 'undefined' ||
        originalText === ''
      ) {
        return;
      }

      // Check if we have an upgrade; if we do, replace the version string with
      // the upgrade, but keep the rest of the content
      const upgrade = Object.keys(
        lowerCasedUpgrades,
      ).filter((packageVersionUpgrade: string) =>
        packageVersionUpgrade.startsWith(`${name.toLowerCase()}@${version}`),
      )[0];

      if (!upgrade) {
        return;
      }
      const newVersion = lowerCasedUpgrades[upgrade].split('@')[1];
      const updatedRequirement = `${originalName}${versionComparator}${newVersion}`;
      changes.push({
        success: true,
        userMessage: `Upgraded ${originalName} from ${version} to ${newVersion}${
          referenceFileInChanges
            ? ` (upgraded in ${referenceFileInChanges})`
            : ''
        }`,
      });
      updatedRequirements[originalText] = `${updatedRequirement}${
        extras ? extras : ''
      }`;
      appliedRemediation.push(upgrade);
    },
  );

  return {
    updatedRequirements,
    changes,
    appliedRemediation,
  };
}
