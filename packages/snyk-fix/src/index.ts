import * as debugLib from 'debug';
import * as pMap from 'p-map';
import * as ora from 'ora';
import * as chalk from 'chalk';

import { showResultsSummary } from './lib/output-formatters/show-results-summary';
import { loadPlugin } from './plugins/load-plugin';
import { FixHandlerResultByPlugin } from './plugins/types';

import { EntityToFix, ErrorsByEcoSystem } from './types';
import { convertErrorToUserMessage } from './lib/errors/error-to-user-message';

const debug = debugLib('snyk-fix:main');

export async function fix(
  entities: EntityToFix[],
): Promise<{
  resultsByPlugin: FixHandlerResultByPlugin;
  exceptionsByScanType: ErrorsByEcoSystem;
}> {
  const spinner = ora().start();
  let resultsByPlugin: FixHandlerResultByPlugin = {};
  const entitiesPerType = groupEntitiesPerScanType(entities);
  const exceptionsByScanType: ErrorsByEcoSystem = {};
  await pMap(
    Object.keys(entitiesPerType),
    async (scanType) => {
      try {
        const fixPlugin = loadPlugin(scanType);
        const results = await fixPlugin(entitiesPerType[scanType]);
        resultsByPlugin = { ...resultsByPlugin, ...results };
      } catch (e) {
        debug(`Failed to processes ${scanType}`, e);
        exceptionsByScanType[scanType] = {
          originals: entitiesPerType[scanType],
          userMessage: convertErrorToUserMessage(e),
        };
      }
    },
    {
      concurrency: 3,
    },
  );
  const fixSummary = await showResultsSummary(
    resultsByPlugin,
    exceptionsByScanType,
  );
  spinner.stopAndPersist({ text: 'Done', symbol: chalk.green('✔') });
  spinner.stopAndPersist({ text: `\n${fixSummary}` });
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
