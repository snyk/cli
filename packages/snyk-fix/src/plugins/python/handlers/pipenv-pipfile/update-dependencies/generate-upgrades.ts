import { EntityToFix } from '../../../../../types';
import { standardizePackageName } from '../../../standardize-package-name';
import { validateRequiredData } from '../../validate-required-data';

export function generateUpgrades(entity: EntityToFix): { upgrades: string[] } {
  const { remediation } = validateRequiredData(entity);
  const { pin: pins } = remediation;

  const upgrades: string[] = [];
  for (const pkgAtVersion of Object.keys(pins)) {
    const pin = pins[pkgAtVersion];
    const newVersion = pin.upgradeTo.split('@')[1];
    const [pkgName] = pkgAtVersion.split('@');
    upgrades.push(`${standardizePackageName(pkgName)}==${newVersion}`);
  }
  return { upgrades };
}
