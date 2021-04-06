import * as debugLib from 'debug';

import { EntityToFix, WithUserMessage } from '../../types';
import { getHandlerType } from './get-handler-type';
import { SUPPORTED_HANDLER_TYPES } from './supported-handler-types';

const debug = debugLib('snyk-fix:python');

export function mapEntitiesPerHandlerType(
  entities: EntityToFix[],
): {
  skipped: Array<WithUserMessage<EntityToFix>>;
  entitiesPerType: {
    [projectType in SUPPORTED_HANDLER_TYPES]: EntityToFix[];
  };
} {
  const entitiesPerType: {
    [projectType in SUPPORTED_HANDLER_TYPES]: EntityToFix[];
  } = {
    [SUPPORTED_HANDLER_TYPES.REQUIREMENTS]: [],
    [SUPPORTED_HANDLER_TYPES.PIPFILE]: [],
  };

  const skipped: Array<WithUserMessage<EntityToFix>> = [];

  for (const entity of entities) {
    const type = getHandlerType(entity);
    if (type) {
      entitiesPerType[type].push(entity);
      continue;
    }
    const userMessage = `${entity.scanResult.identity.targetFile} is not supported`;
    debug(userMessage);
    skipped.push({ original: entity, userMessage });
  }

  return { entitiesPerType, skipped };
}
