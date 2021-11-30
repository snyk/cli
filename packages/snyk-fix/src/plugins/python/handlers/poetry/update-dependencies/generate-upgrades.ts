import pathLib from 'path';
import toml from 'toml';

import debugLib from 'debug';

import { EntityToFix } from '../../../../../types';

import { validateRequiredData } from '../../validate-required-data';
import { standardizePackageName } from '../../../standardize-package-name';

const debug = debugLib('snyk-fix:python:Poetry');

interface PyProjectToml {
  tool: {
    poetry: {
      name: string;
      version: string;
      description: string;
      authors: string[];
      dependencies?: object;
      'dev-dependencies'?: object;
    };
  };
}

export async function generateUpgrades(
  entity: EntityToFix,
): Promise<{ upgrades: string[]; devUpgrades: string[] }> {
  const { remediation, targetFile } = validateRequiredData(entity);
  const pins = remediation.pin;

  const targetFilePath = pathLib.resolve(entity.workspace.path, targetFile);
  const { dir } = pathLib.parse(targetFilePath);
  const pyProjectTomlRaw = await entity.workspace.readFile(
    pathLib.resolve(dir, 'pyproject.toml'),
  );
  const pyProjectToml: PyProjectToml = toml.parse(pyProjectTomlRaw);

  const prodTopLevelDeps = Object.keys(
    pyProjectToml.tool.poetry.dependencies ?? {},
  ).map((dep) => standardizePackageName(dep));
  const devTopLevelDeps = Object.keys(
    pyProjectToml.tool.poetry['dev-dependencies'] ?? {},
  ).map((dep) => standardizePackageName(dep));

  const upgrades: string[] = [];
  const devUpgrades: string[] = [];
  for (const pkgAtVersion of Object.keys(pins)) {
    const pin = pins[pkgAtVersion];
    const newVersion = pin.upgradeTo.split('@')[1];
    const [pkgName] = pkgAtVersion.split('@');

    const upgrade = `${standardizePackageName(pkgName)}==${newVersion}`;

    if (pin.isTransitive || prodTopLevelDeps.includes(pkgName)) {
      // transitive and it could have come from a dev or prod dep
      // since we can't tell right now let be pinned into production deps
      upgrades.push(upgrade);
    } else if (prodTopLevelDeps.includes(pkgName)) {
      upgrades.push(upgrade);
    } else if (entity.options.dev && devTopLevelDeps.includes(pkgName)) {
      devUpgrades.push(upgrade);
    } else {
      debug(
        `Could not determine what type of upgrade ${upgrade} is. When choosing between: transitive upgrade, production or dev direct upgrade. `,
      );
    }
  }
  return { upgrades, devUpgrades };
}
