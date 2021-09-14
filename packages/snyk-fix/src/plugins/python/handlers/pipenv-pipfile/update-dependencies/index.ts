import * as debugLib from 'debug';

import { PluginFixResponse } from '../../../../types';
import {
  EntityToFix,
  FixChangesSummary,
  FixOptions,
} from '../../../../../types';
import { NoFixesCouldBeAppliedError } from '../../../../../lib/errors/no-fixes-applied';
import { standardizePackageName } from '../../../standardize-package-name';
import { validateRequiredData } from '../../validate-required-data';

import { ensureHasUpdates } from '../../ensure-has-updates';
import { pipenvAdd } from './pipenv-add';

const debug = debugLib('snyk-fix:python:Pipfile');

export async function updateDependencies(
  entity: EntityToFix,
  options: FixOptions,
): Promise<PluginFixResponse> {
  const handlerResult = await fixAll(entity, options);
  return handlerResult;
}

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

async function fixAll(
  entity: EntityToFix,
  options: FixOptions,
): Promise<PluginFixResponse> {
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };
  const { upgrades } = await generateUpgrades(entity);
  if (!upgrades.length) {
    throw new NoFixesCouldBeAppliedError(
      'Failed to calculate package updates to apply',
    );
  }
  const changes: FixChangesSummary[] = [];
  try {
    // TODO: for better support we need to:
    // 1. parse the manifest and extract original requirements, version spec etc
    // 2. swap out only the version and retain original spec
    // 3. re-lock the lockfile
    // Currently this is not possible as there is no Pipfile parser that would do this.
    // update prod dependencies first
    if (upgrades.length) {
      changes.push(...(await pipenvAdd(entity, options, upgrades)));
    }

    ensureHasUpdates(changes);
    handlerResult.succeeded.push({
      original: entity,
      changes,
    });
  } catch (error) {
    debug(
      `Failed to fix ${entity.scanResult.identity.targetFile}.\nERROR: ${error}`,
    );
    handlerResult.failed.push({
      original: entity,
      error,
      tip: error.tip,
    });
  }
  return handlerResult;
}
