import { DependencyPins, FixChangesSummary } from '../../../../types';
import { parseRequirementsFile, Requirement } from './requirements-file-parser';

/*
 * Given contents of manifest file(s) and a set of upgrades, apply the given
 * upgrades to a manifest and return the upgraded manifest.
 *
 * Currently only supported for `requirements.txt` - at least one file named
 * `requirements.txt` must be in the manifests.
 */
export function updateDependencies(
  requirementsTxt: string,
  upgrades: DependencyPins,
): { updatedManifest: string; changes: FixChangesSummary[] } {
  const parsedRequirementsData = parseRequirementsFile(requirementsTxt);

  // Lowercase the upgrades object. This might be overly defensive, given that
  // we control this input internally, but its a low cost guard rail. Outputs a
  // mapping of upgrade to -> from, instead of the nested upgradeTo object.
  const lowerCasedUpgrades: { [upgradeFrom: string]: string } = {};
  Object.keys(upgrades).forEach((upgrade) => {
    const { upgradeTo } = upgrades[upgrade];
    lowerCasedUpgrades[upgrade.toLowerCase()] = upgradeTo.toLowerCase();
  });

  // TODO: record failed upgrades & pins and send them back
  // to be shown in the UI,  do not break PR creation
  const { updatedRequirements, changes: upgradedChanges } = applyUpgrades(
    parsedRequirementsData,
    lowerCasedUpgrades,
  );

  const topLevelDeps = parsedRequirementsData
    .map(({ name }) => name && name.toLowerCase())
    .filter(isDefined);

  const { pinnedRequirements, changes: pinChanges } = applyPins(
    topLevelDeps,
    lowerCasedUpgrades,
  );

  let updatedManifest = [...updatedRequirements, ...pinnedRequirements].join(
    '\n',
  );
  // This is a bit of a hack, but an easy one to follow. If a file ends with a
  // new line, ensure we keep it this way. Don't hijack customers formatting.
  if (requirementsTxt.endsWith('\n')) {
    updatedManifest += '\n';
  }

  if (updatedManifest === requirementsTxt) {
    throw new Error('Looks like no fixes could be applied.');
  }

  return {
    updatedManifest,
    changes: [...pinChanges, ...upgradedChanges],
  };
}

// TS is not capable of determining when Array.filter has removed undefined
// values without a manual Type Guard, so thats what this does
function isDefined<T>(t: T | undefined): t is T {
  return typeof t !== 'undefined';
}

function applyPins(
  topLevelDeps: string[],
  lowerCasedUpgrades: { [upgradeFrom: string]: string },
): { pinnedRequirements: string[]; changes: FixChangesSummary[] } {
  const changes: FixChangesSummary[] = [];
  const pinnedRequirements = Object.keys(lowerCasedUpgrades)
    .map((pkgNameAtVersion) => {
      const [pkgName, version] = pkgNameAtVersion.split('@');

      // Pinning is only for non top level deps
      if (topLevelDeps.indexOf(pkgName) >= 0) {
        return;
      }

      const newVersion = lowerCasedUpgrades[pkgNameAtVersion].split('@')[1];
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

function applyUpgrades(
  requirements: Requirement[],
  lowerCasedUpgrades: { [upgradeFrom: string]: string },
): { updatedRequirements: string[]; changes: FixChangesSummary[] } {
  const changes: FixChangesSummary[] = [];
  const updatedRequirements: string[] = requirements.map(
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
        return originalText;
      }

      // Check if we have an upgrade; if we do, replace the version string with
      // the upgrade, but keep the rest of the content
      const upgrade = Object.keys(
        lowerCasedUpgrades,
      ).filter((packageVersionUpgrade: string) =>
        packageVersionUpgrade.startsWith(`${name.toLowerCase()}@${version}`),
      )[0];

      if (!upgrade) {
        return originalText;
      }
      const newVersion = lowerCasedUpgrades[upgrade].split('@')[1];
      const updatedRequirement = `${originalName}${versionComparator}${newVersion}`;
      changes.push({
        success: true,
        userMessage: `Upgraded ${originalName} from ${version} to ${newVersion}`,
      });
      return `${updatedRequirement}${extras ? extras : ''}`;
    },
  );

  return {
    updatedRequirements,
    changes,
  };
}
