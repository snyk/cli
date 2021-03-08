import * as debugLib from 'debug';
import * as pMap from 'p-map';
import * as micromatch from 'micromatch';
import * as ora from 'ora';

import { EntityToFix, FixOptions } from '../../types';
import { FixHandlerResultByPlugin } from '../types';
import { loadHandler } from './load-handler';
import { SUPPORTED_PROJECT_TYPES } from './supported-project-types';

const debug = debugLib('snyk-fix:python');

export async function pythonFix(
  entities: EntityToFix[],
  options: FixOptions,
): Promise<FixHandlerResultByPlugin> {
  const spinner = ora({ isSilent: options.quiet });
  spinner.text = 'Looking for supported Python items';
  spinner.start();
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
      const userMessage = `${entity.scanResult.identity.targetFile} is not supported`;
      debug(userMessage);
      handlerResult[pluginId].skipped.push({ original: entity, userMessage });
      continue;
    }
    entitiesPerType[type].push(entity);
  }
  spinner.succeed();

  await pMap(
    Object.keys(entitiesPerType),
    async (projectType) => {
      const projectsToFix: EntityToFix[] = entitiesPerType[projectType];

      spinner.text = `Processing ${projectsToFix.length} ${projectType} items.`;
      spinner.render();

      try {
        const handler = loadHandler(projectType as SUPPORTED_PROJECT_TYPES);
        const { failed, skipped, succeeded } = await handler(
          projectsToFix,
          options,
        );
        handlerResult[pluginId].failed.push(...failed);
        handlerResult[pluginId].skipped.push(...skipped);
        handlerResult[pluginId].succeeded.push(...succeeded);
      } catch (e) {
        debug(
          `Failed to fix ${projectsToFix.length} ${projectType} projects.\nError: ${e.message}`,
        );
        handlerResult[pluginId].failed.push(
          ...projectsToFix.map((p) => ({ original: p, error: e })),
        );
      }
    },
    {
      concurrency: 5,
    },
  );
  spinner.succeed();
  return handlerResult;
}

export function isRequirementsTxtManifest(targetFile: string): boolean {
  return micromatch.isMatch(
    targetFile,
    // micromatch needs **/* to match filenames that may include folders
    ['*req*.txt', 'requirements/*.txt', 'requirements*', '*.txt'].map(
      (f) => '**/' + f,
    ),
  );
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
