import * as debugLib from 'debug';
import { loadPlugin } from './plugins/load-plugin';
import { FixHandlerResult } from './plugins/types';

import { EntityToFix } from './types';

const debug = debugLib('snyk-fix:main');

export async function fix(
  entities: EntityToFix[],
): Promise<FixHandlerResult[]> {
  debug(`Requested to fix ${entities.length} projects.`);
  const entitiesPerType = groupEntitiesPerType(entities);
  const allResults: FixHandlerResult[] = [];
  // TODO: pMap this?
  for (const type of Object.keys(entitiesPerType)) {
    const handler = loadPlugin(type);
    const results = await handler(entitiesPerType[type]);
    allResults.push(results);
  }

  return allResults;
}

function groupEntitiesPerType(
  entities: EntityToFix[],
): {
  [type: string]: EntityToFix[];
} {
  const entitiesPerType: {
    [type: string]: EntityToFix[];
  } = {};
  for (const entity of entities) {
    const type = entity.scanResult.identity.type;
    if (entitiesPerType[type]) {
      entitiesPerType[type].push(entity);
      continue;
    }
    entitiesPerType[type] = [entity];
  }
  return entitiesPerType;
}
