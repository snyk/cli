import debugLib from 'debug';

import { PluginFixResponse } from '../../../../types';
import {
  EntityToFix,
  FixChangesSummary,
  FixOptions,
} from '../../../../../types';

import { NoFixesCouldBeAppliedError } from '../../../../../lib/errors/no-fixes-applied';
import { generateUpgrades } from './generate-upgrades';
import { pipenvAdd } from './pipenv-add';
import { isSuccessfulChange } from '../../attempted-changes-summary';

const debug = debugLib('snyk-fix:python:Pipfile');

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
  const changes: FixChangesSummary[] = [];
  try {
    const { upgrades } = await generateUpgrades(entity);
    if (!upgrades.length) {
      throw new NoFixesCouldBeAppliedError(
        'Failed to calculate package updates to apply',
      );
    }
    // TODO: for better support we need to:
    // 1. parse the manifest and extract original requirements, version spec etc
    // 2. swap out only the version and retain original spec
    // 3. re-lock the lockfile
    // Currently this is not possible as there is no Pipfile parser that would do this.
    // update prod dependencies first
    if (upgrades.length) {
      changes.push(...(await pipenvAdd(entity, options, upgrades)));
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
      error,
      tip: error.tip,
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
  const { upgrades } = await generateUpgrades(entity);
  // TODO: for better support we need to:
  // 1. parse the manifest and extract original requirements, version spec etc
  // 2. swap out only the version and retain original spec
  // 3. re-lock the lockfile
  // at the moment we do not parse Pipfile and therefore can't tell the difference
  // between prod & dev updates
  const changes: FixChangesSummary[] = [];

  try {
    if (!upgrades.length) {
      throw new NoFixesCouldBeAppliedError(
        'Failed to calculate package updates to apply',
      );
    }
    // update prod dependencies first
    if (upgrades.length) {
      for (const upgrade of upgrades) {
        changes.push(...(await pipenvAdd(entity, options, [upgrade])));
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
