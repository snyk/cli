import * as debugLib from 'debug';
import { isNpmOverridesSupported } from '@snyk/node-fix';

import { PluginFixResponse } from '../../../../types';
import {
  EntityToFix,
  FixChangesSummary,
  FixOptions,
} from '../../../../../types';

import { NoFixesCouldBeAppliedError } from '../../../../../lib/errors/no-fixes-applied';
import { generateUpgrades } from './generate-upgrades';
import { partitionByFixType, PartitionedUpgrades } from './partition-by-fix-type';
import { applyFixes } from './apply-fixes';
import { applyOverrides } from './apply-overrides';
import { isSuccessfulChange } from '../../attempted-changes-summary';

const debug = debugLib('snyk-fix:node:npm');

export async function updateDependencies(
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
    // Generate the list of upgrades from remediation data
    const upgrades = await generateUpgrades(entity);

    const hasUpgrades = upgrades.length > 0;

    // Partition upgrades into update vs install batches based on semver
    let partitioned: PartitionedUpgrades = {
      withinRange: [],
      outsideRange: [],
    };

    if (hasUpgrades) {
      partitioned = await partitionByFixType(entity, upgrades);
      // Apply the fixes
      changes.push(...(await applyFixes(entity, partitioned, options)));
    }

    // Handle overrides if --use-overrides flag is set
    if (options.useOverrides) {
      const overridesSupported = await isNpmOverridesSupported();

      if (!overridesSupported) {
        debug('npm overrides not supported (requires npm >= 8.3)');
      } else if (entity.overrideCandidates?.length) {
        debug(
          `Found ${entity.overrideCandidates.length} override candidates`,
        );
        changes.push(...(await applyOverrides(entity, options)));
      }
    }

    if (!changes.length) {
      throw new NoFixesCouldBeAppliedError(
        'Failed to calculate package updates to apply',
      );
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

