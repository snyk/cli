import { DependencyPins } from '../../../../../types';
import { isDefined } from './is-defined';
import { Requirement } from './requirements-file-parser';
import { standardizePackageName } from './standardize-package-name';

export type FixesType = 'direct-upgrades' | 'transitive-pins';

export function calculateRelevantFixes(
  requirements: Requirement[],
  updates: DependencyPins,
  type: FixesType,
): DependencyPins {
  const lowerCasedUpdates = {};
  const topLevelDeps = requirements.map(({ name }) => name).filter(isDefined);

  Object.keys(updates).forEach((update) => {
    const { upgradeTo } = updates[update];
    const [pkgName] = update.split('@');
    const isTransitive =
      topLevelDeps.indexOf(standardizePackageName(pkgName)) < 0;
    if (type === 'transitive-pins' ? isTransitive : !isTransitive) {
      const [name, newVersion] = upgradeTo.split('@');

      lowerCasedUpdates[update] = {
        ...updates[update],
        upgradeTo: `${standardizePackageName(name)}@${newVersion}`,
      };
    }
  });
  return lowerCasedUpdates;
}
