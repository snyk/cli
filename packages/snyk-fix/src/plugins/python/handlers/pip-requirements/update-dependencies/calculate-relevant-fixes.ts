import { DependencyPins } from '../../../../../types';
import { isDefined } from './is-defined';
import { Requirement } from './requirements-file-parser';

export type FixesType = 'direct-upgrades' | 'transitive-pins';

export function calculateRelevantFixes(
  requirements: Requirement[],
  updates: DependencyPins,
  type: FixesType,
): { [upgradeFrom: string]: string } {
  const lowerCasedUpdates: { [upgradeFrom: string]: string } = {};
  const topLevelDeps = requirements
    .map(({ name }) => name && name.toLowerCase())
    .filter(isDefined);

  Object.keys(updates).forEach((update) => {
    const { upgradeTo } = updates[update];
    const [pkgName] = update.split('@');
    const isTransitive = topLevelDeps.indexOf(pkgName.toLowerCase()) < 0;
    if (type === 'transitive-pins' ? isTransitive : !isTransitive) {
      lowerCasedUpdates[update.toLowerCase()] = upgradeTo.toLowerCase();
    }
  });
  return lowerCasedUpdates;
}
