import * as debugLib from 'debug';
import * as pMap from 'p-map';

import { EntityToFix } from '../../types';
import { FixHandlerResultByPlugin } from '../types';
import { loadHandler } from './load-handler';
import { SUPPORTED_PROJECT_TYPES } from './supported-project-types';

const debug = debugLib('snyk-fix:python');

export async function pythonFix(
  entities: EntityToFix[],
): Promise<FixHandlerResultByPlugin> {
  debug(`Preparing to fix ${entities.length} Python projects`);
  const pluginId = 'python';
  const handlerResult: FixHandlerResultByPlugin = {
    [pluginId]: {
      succeeded: [],
      failed: [],
      skipped: [],
    },
  };

  const entitiesPerType: {
    [projectType in SUPPORTED_PROJECT_TYPES]: EntityToFix[];
  } = {
    [SUPPORTED_PROJECT_TYPES.REQUIREMENTS]: [],
  };
  for (const entity of entities) {
    const type = getProjectType(entity);
    if (!type) {
      const userMessage = `Skipping project: ${entity.scanResult.identity.targetFile} as it is not supported`;
      debug(userMessage);
      handlerResult[pluginId].skipped.push({ original: entity, userMessage });
      continue;
    }
    entitiesPerType[type].push(entity);
  }

  await pMap(
    Object.keys(entitiesPerType),
    async (projectType) => {
      const projectsToFix = entitiesPerType[projectType];

      try {
        const handler = loadHandler(projectType as SUPPORTED_PROJECT_TYPES);
        const { failed, skipped, succeeded } = await handler(projectsToFix);
        handlerResult[pluginId].failed.push(...failed);
        handlerResult[pluginId].skipped.push(...skipped);
        handlerResult[pluginId].succeeded.push(...succeeded);
      } catch (e) {
        debug(
          `Failed to fix ${projectsToFix.length} ${projectType} projects.\nError: ${e.message}`,
        );
        handlerResult[pluginId].failed.push(...projectsToFix);
      }
    },
    {
      concurrency: 5,
    },
  );

  return handlerResult;
}

export function isRequirementsTxtManifest(targetFile: string): boolean {
  return targetFile.endsWith('.txt');
}

export function getProjectType(
  entity: EntityToFix,
): SUPPORTED_PROJECT_TYPES | null {
  const targetFile = entity.scanResult.identity.targetFile;
  if (!targetFile) {
    return null;
  }
  const isRequirementsTxt = isRequirementsTxtManifest(targetFile);
  if (isRequirementsTxt) {
    return SUPPORTED_PROJECT_TYPES.REQUIREMENTS;
  }
  return null;
}
