import * as debugLib from 'debug';
import { convertErrorToUserMessage } from './lib/errors/error-to-user-message';
import { loadPlugin } from './plugins/load-plugin';
import { FixHandlerResultByPlugin } from './plugins/types';

import { EntityToFix } from './types';

const debug = debugLib('snyk-fix:main');

export async function fix(
  entities: EntityToFix[],
): Promise<{
  resultsByPlugin: FixHandlerResultByPlugin;
  exceptionsByScanType: { [ecosystem: string]: Error[] };
}> {
  debug(`Requested to fix ${entities.length} projects.`);
  let resultsByPlugin: FixHandlerResultByPlugin = {};
  const entitiesPerType = groupEntitiesPerScanType(entities);
  const exceptionsByScanType: { [ecosystem: string]: Error[] } = {};
  // TODO: pMap this?
  for (const scanType of Object.keys(entitiesPerType)) {
    try {
      const fixPlugin = loadPlugin(scanType);
      const results = await fixPlugin(entitiesPerType[scanType]);
      resultsByPlugin = {...resultsByPlugin, ...results};
    } catch (e) {
      // TODO: use ora?
      console.error(convertErrorToUserMessage(e));
      if (!exceptionsByScanType[scanType]) {
        exceptionsByScanType[scanType] = [e];
      } else {
        exceptionsByScanType[scanType].push(e);
      }
    }
  }
  return { resultsByPlugin, exceptionsByScanType };
}

export function groupEntitiesPerScanType(
  entities: EntityToFix[],
): {
  [type: string]: EntityToFix[];
} {
  const entitiesPerType: {
    [type: string]: EntityToFix[];
  } = {};
  for (const entity of entities) {
    const type = entity.scanResult?.identity?.type || 'missing-type';
    if (entitiesPerType[type]) {
      entitiesPerType[type].push(entity);
      continue;
    }
    entitiesPerType[type] = [entity];
  }
  return entitiesPerType;
}

