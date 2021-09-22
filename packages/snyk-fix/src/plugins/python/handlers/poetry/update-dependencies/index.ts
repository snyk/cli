import * as debugLib from 'debug';

import { PluginFixResponse } from '../../../../types';
import {
  EntityToFix,
  FixChangesSummary,
  FixOptions,
} from '../../../../../types';
import { generateUpgrades } from './generate-upgrades';
import { poetryAdd } from './poetry-add';
import { NoFixesCouldBeAppliedError } from '../../../../../lib/errors/no-fixes-applied';
import { isSuccessfulChange } from '../../attempted-changes-summary';

const debug = debugLib('snyk-fix:python:Poetry');

function chooseFixStrategy(options: FixOptions) {
  return options.sequentialFix ? fixSequentially : fixAll;
}

export async function updateDependencies(
  entity: EntityToFix,
  options: FixOptions,
): Promise<PluginFixResponse> {
  const handlerResult = await chooseFixStrategy(options)(entity, options);
  return handlerResult;
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
  const { upgrades, devUpgrades } = await generateUpgrades(entity);

  // TODO: for better support we need to:
  // 1. parse the manifest and extract original requirements, version spec etc
  // 2. swap out only the version and retain original spec
  // 3. re-lock the lockfile
  const changes: FixChangesSummary[] = [];
  try {
    if (![...upgrades, ...devUpgrades].length) {
      throw new NoFixesCouldBeAppliedError(
        'Failed to calculate package updates to apply',
      );
    }
    // update prod dependencies first
    if (upgrades.length) {
      changes.push(...(await poetryAdd(entity, options, upgrades)));
    }

    // update dev dependencies second
    if (devUpgrades.length) {
      const installDev = true;
      changes.push(
        ...(await poetryAdd(entity, options, devUpgrades, installDev)),
      );
    }

    if (!changes.length) {
      throw new NoFixesCouldBeAppliedError();
    }
    if (!changes.some((c) => isSuccessfulChange(c))) {
      handlerResult.failed.push({
        original: entity,
        changes,
      });
    } else {
      handlerResult.succeeded.push({
        original: entity,
        changes,
      });
    }
  } catch (error) {
    debug(
      `Failed to fix ${entity.scanResult.identity.targetFile}.\nERROR: ${error}`,
    );
    handlerResult.failed.push({
      original: entity,
      tip: error.tip,
      error,
    });
  }
  return handlerResult;
}

async function fixSequentially(
  entity: EntityToFix,
  options: FixOptions,
): Promise<PluginFixResponse> {
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };
  const { upgrades, devUpgrades } = await generateUpgrades(entity);
  // TODO: for better support we need to:
  // 1. parse the manifest and extract original requirements, version spec etc
  // 2. swap out only the version and retain original spec
  // 3. re-lock the lockfile
  const changes: FixChangesSummary[] = [];
  try {
    if (![...upgrades, ...devUpgrades].length) {
      throw new NoFixesCouldBeAppliedError(
        'Failed to calculate package updates to apply',
      );
    }
    // update prod dependencies first
    if (upgrades.length) {
      for (const upgrade of upgrades) {
        changes.push(...(await poetryAdd(entity, options, [upgrade])));
      }
    }

    // update dev dependencies second
    if (devUpgrades.length) {
      for (const upgrade of devUpgrades) {
        const installDev = true;
        changes.push(
          ...(await poetryAdd(entity, options, [upgrade], installDev)),
        );
      }
    }
    if (!changes.length) {
      throw new NoFixesCouldBeAppliedError();
    }
    if (!changes.some((c) => isSuccessfulChange(c))) {
      handlerResult.failed.push({
        original: entity,
        changes,
      });
    } else {
      handlerResult.succeeded.push({
        original: entity,
        changes,
      });
    }
  } catch (error) {
    debug(
      `Failed to fix ${entity.scanResult.identity.targetFile}.\nERROR: ${error}`,
    );
    handlerResult.failed.push({
      original: entity,
      tip: error.tip,
      error,
    });
  }
  return handlerResult;
}
