import { DependencyPins, FixChangesSummary } from '../../../../../types';
import { calculateRelevantFixes } from './calculate-relevant-fixes';
import { isDefined } from './is-defined';
import { Requirement } from './requirements-file-parser';
import { standardizePackageName } from '../../../standardize-package-name';

export function generatePins(
  requirements: Requirement[],
  updates: DependencyPins,
  referenceFileInChanges?: string,
): {
  pinnedRequirements: string[];
  changes: FixChangesSummary[];
} {
  // Lowercase the upgrades object. This might be overly defensive, given that
  // we control this input internally, but its a low cost guard rail. Outputs a
  // mapping of upgrade to -> from, instead of the nested upgradeTo object.
  const standardizedPins = calculateRelevantFixes(
    requirements,
    updates,
    'transitive-pins',
  );

  if (Object.keys(standardizedPins).length === 0) {
    return {
      pinnedRequirements: [],
      changes: [],
    };
  }
  const changes: FixChangesSummary[] = [];
  const pinnedRequirements = Object.keys(standardizedPins)
    .map((pkgNameAtVersion) => {
      const [pkgName, version] = pkgNameAtVersion.split('@');
      const newVersion = standardizedPins[pkgNameAtVersion].upgradeTo.split(
        '@',
      )[1];
      const newRequirement = `${standardizePackageName(
        pkgName,
      )}>=${newVersion}`;
      changes.push({
        from: `${pkgName}@${version}`,
        to: `${pkgName}@${newVersion}`,
        issueIds: standardizedPins[pkgNameAtVersion].vulns,
        success: true,
        userMessage: `Pinned ${standardizePackageName(
          pkgName,
        )} from ${version} to ${newVersion}${
          referenceFileInChanges ? ` (pinned in ${referenceFileInChanges})` : ''
        }`,
      });
      return `${newRequirement} # not directly required, pinned by Snyk to avoid a vulnerability`;
    })
    .filter(isDefined);

  return {
    pinnedRequirements,
    changes,
  };
}
