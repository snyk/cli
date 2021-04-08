import * as debugLib from 'debug';
import * as pMap from 'p-map';
import * as ora from 'ora';

import { EntityToFix, FixOptions } from '../../types';
import { FixHandlerResultByPlugin } from '../types';
import { loadHandler } from './load-handler';
import { SUPPORTED_HANDLER_TYPES } from './supported-handler-types';
import { mapEntitiesPerHandlerType } from './map-entities-per-handler-type';
import chalk = require('chalk');

const debug = debugLib('snyk-fix:python');

export async function pythonFix(
  entities: EntityToFix[],
  options: FixOptions,
): Promise<FixHandlerResultByPlugin> {
  const spinner = ora({ isSilent: options.quiet, stream: process.stdout });
  const spinnerMessage = 'Looking for supported Python items';
  spinner.text = spinnerMessage;
  spinner.start();

  const handlerResult: FixHandlerResultByPlugin = {
    python: {
      succeeded: [],
      failed: [],
      skipped: [],
    },
  };
  const results = handlerResult.python;
  const { entitiesPerType, skipped: notSupported } = mapEntitiesPerHandlerType(
    entities,
  );
  results.skipped.push(...notSupported);

  spinner.stopAndPersist({
    text: spinnerMessage,
    symbol: chalk.green('\n✔'),
  });

  await pMap(
    Object.keys(entitiesPerType),
    async (projectType) => {
      const projectsToFix: EntityToFix[] = entitiesPerType[projectType];

      const processingMessage = `Processing ${projectsToFix.length} ${projectType} items`;
      spinner.text = processingMessage;
      spinner.render();

      try {
        const handler = loadHandler(projectType as SUPPORTED_HANDLER_TYPES);
        const { failed, skipped, succeeded } = await handler(
          projectsToFix,
          options,
        );
        results.failed.push(...failed);
        results.skipped.push(...skipped);
        results.succeeded.push(...succeeded);
      } catch (e) {
        debug(
          `Failed to fix ${projectsToFix.length} ${projectType} projects.\nError: ${e.message}`,
        );
        results.failed.push(
          ...projectsToFix.map((p) => ({ original: p, error: e })),
        );
      }
      spinner.stopAndPersist({
        text: processingMessage,
        symbol: chalk.green('✔'),
      });
    },
    {
      concurrency: 5,
    },
  );
  return handlerResult;
}
