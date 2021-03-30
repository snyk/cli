import { DependencyPins, FixChangesSummary } from '../../../../../types';
import { calculateRelevantFixes } from './calculate-relevant-fixes';
import { isDefined } from './is-defined';
import { Requirement } from './requirements-file-parser';

export function generatePins(
  requirements: Requirement[],
  updates: DependencyPins,
): {
  pinnedRequirements: string[];
  changes: FixChangesSummary[];
  appliedRemediation: string[];
} {
  // Lowercase the upgrades object. This might be overly defensive, given that
  // we control this input internally, but its a low cost guard rail. Outputs a
  // mapping of upgrade to -> from, instead of the nested upgradeTo object.
  const lowerCasedPins = calculateRelevantFixes(
    requirements,
    updates,
    'transitive-pins',
  );

  if (Object.keys(lowerCasedPins).length === 0) {
    return {
      pinnedRequirements: [],
      changes: [],
      appliedRemediation: [],
    };
  }
  const appliedRemediation: string[] = [];
  const changes: FixChangesSummary[] = [];
  const pinnedRequirements = Object.keys(lowerCasedPins)
    .map((pkgNameAtVersion) => {
      const [pkgName, version] = pkgNameAtVersion.split('@');
      const newVersion = lowerCasedPins[pkgNameAtVersion].split('@')[1];
      const newRequirement = `${pkgName}>=${newVersion}`;
      changes.push({
        success: true,
        userMessage: `Pinned ${pkgName} from ${version} to ${newVersion}`,
      });
      appliedRemediation.push(pkgNameAtVersion);
      return `${newRequirement} # not directly required, pinned by Snyk to avoid a vulnerability`;
    })
    .filter(isDefined);

  return {
    pinnedRequirements,
    changes,
    appliedRemediation,
  };
}
