import { DependencyPins, FixChangesSummary } from '../../../../../types';
import { isDefined } from './is-defined';
import { Requirement } from './requirements-file-parser';

export function generatePins(
  requirements: Requirement[],
  updates: DependencyPins,
): { pinnedRequirements: string[]; changes: FixChangesSummary[] } {
  const topLevelDeps = requirements
    .map(({ name }) => name && name.toLowerCase())
    .filter(isDefined);

  // Lowercase the upgrades object. This might be overly defensive, given that
  // we control this input internally, but its a low cost guard rail. Outputs a
  // mapping of upgrade to -> from, instead of the nested upgradeTo object.
  const lowerCasedPins: { [upgradeFrom: string]: string } = {};

  Object.keys(updates).forEach((update) => {
    const { upgradeTo, isTransitive } = updates[update];
    if (isTransitive) {
      lowerCasedPins[update.toLowerCase()] = upgradeTo.toLowerCase();
    }
  });

  if (Object.keys(lowerCasedPins).length === 0) {
    return {
      pinnedRequirements: [],
      changes: [],
    };
  }

  const changes: FixChangesSummary[] = [];
  const pinnedRequirements = Object.keys(lowerCasedPins)
    .map((pkgNameAtVersion) => {
      const [pkgName, version] = pkgNameAtVersion.split('@');

      // Pinning is only for non top level deps
      if (topLevelDeps.indexOf(pkgName) >= 0) {
        return;
      }

      const newVersion = lowerCasedPins[pkgNameAtVersion].split('@')[1];
      const newRequirement = `${pkgName}>=${newVersion}`;
      changes.push({
        success: true,
        userMessage: `Pinned ${pkgName} from ${version} to ${newVersion}`,
      });
      return `${newRequirement} # not directly required, pinned by Snyk to avoid a vulnerability`;
    })
    .filter(isDefined);

  return {
    pinnedRequirements,
    changes,
  };
}
