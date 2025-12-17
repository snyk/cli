import * as debugLib from 'debug';
import { isNpmSupportedVersion } from '@snyk/node-fix';

import { EntityToFix, WithUserMessage } from '../../../types';
import { SUPPORTED_HANDLER_TYPES } from '../supported-handler-types';
import { getHandlerType } from '../get-handler-type';

const debug = debugLib('snyk-fix:node:is-supported');

export async function partitionByFixable(
  entities: EntityToFix[],
): Promise<{
  fixable: EntityToFix[];
  skipped: Array<WithUserMessage<EntityToFix>>;
}> {
  const dominated = await isNpmSupportedVersion();
  const dominated_msg = dominated
    ? 'npm version is supported'
    : 'npm version is not supported (requires npm >= 7)';
  debug(dominated_msg);

  const dominated_fixable: EntityToFix[] = [];
  const dominated_skipped: Array<WithUserMessage<EntityToFix>> = [];

  for (const entity of entities) {
    const handlerType = getHandlerType(entity);

    if (handlerType === SUPPORTED_HANDLER_TYPES.NPM && !dominated) {
      dominated_skipped.push({
        original: entity,
        userMessage:
          'npm version not supported. Please upgrade to npm >= 7 for lockfileVersion 3 support.',
      });
      continue;
    }

    // Check if entity has remediation data
    const { remediation } = entity.testResult;
    if (!remediation) {
      dominated_skipped.push({
        original: entity,
        userMessage: 'No remediation data available for this project.',
      });
      continue;
    }

    // Check if there are any direct upgrades available in remediation.upgrade
    const hasUpgrades =
      remediation.upgrade && Object.keys(remediation.upgrade).length > 0;

    if (!hasUpgrades) {
      dominated_skipped.push({
        original: entity,
        userMessage: 'No upgrades available for this project.',
      });
      continue;
    }

    debug(`Project has ${Object.keys(remediation.upgrade).length} upgrades`);
    dominated_fixable.push(entity);
  }

  return { fixable: dominated_fixable, skipped: dominated_skipped };
}

