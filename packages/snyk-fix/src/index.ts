import * as debugLib from 'debug';
import * as pMap from 'p-map';
import * as ora from 'ora';
import * as chalk from 'chalk';

import * as outputFormatter from './lib/output-formatters/show-results-summary';
import { loadPlugin } from './plugins/load-plugin';
import { FixHandlerResultByPlugin } from './plugins/types';
import { partitionByVulnerable } from './partition-by-vulnerable';

import { EntityToFix, ErrorsByEcoSystem, FixedMeta, FixOptions } from './types';
import { convertErrorToUserMessage } from './lib/errors/error-to-user-message';
export { EntityToFix } from './types';

const debug = debugLib('snyk-fix:main');

export async function fix(
  entities: EntityToFix[],
  options: FixOptions = {
    dryRun: false,
    quiet: false,
    stripAnsi: false,
  },
): Promise<{
  results: FixHandlerResultByPlugin;
  exceptions: ErrorsByEcoSystem;
  meta: FixedMeta;
  fixSummary: string;
}> {
  const spinner = ora({ isSilent: options.quiet, stream: process.stdout });

  let resultsByPlugin: FixHandlerResultByPlugin = {};
  const {
    vulnerable,
    notVulnerable: nothingToFix,
  } = await partitionByVulnerable(entities);
  const entitiesPerType = groupEntitiesPerScanType(vulnerable);
  const exceptions: ErrorsByEcoSystem = {};
  await pMap(
    Object.keys(entitiesPerType),
    async (scanType) => {
      try {
        const fixPlugin = loadPlugin(scanType);
        const results = await fixPlugin(entitiesPerType[scanType], options);
        resultsByPlugin = { ...resultsByPlugin, ...results };
      } catch (e) {
        debug(`Failed to processes ${scanType}`, e);
        exceptions[scanType] = {
          originals: entitiesPerType[scanType],
          userMessage: convertErrorToUserMessage(e),
        };
      }
    },
    {
      concurrency: 3,
    },
  );
  const fixSummary = await outputFormatter.showResultsSummary(
    nothingToFix,
    resultsByPlugin,
    exceptions,
    options,
    entities.length,
  );
  const meta = extractMeta(resultsByPlugin, exceptions);

  spinner.start();
  if (meta.fixed > 0) {
    spinner.stopAndPersist({
      text: 'Done',
      symbol: chalk.green('✔'),
    });
  } else {
    spinner.stop();
  }

  return {
    results: resultsByPlugin,
    exceptions,
    fixSummary,
    meta,
  };
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
    // TODO: group all node
    const type = entity.scanResult?.identity?.type ?? 'missing-type';
    if (entitiesPerType[type]) {
      entitiesPerType[type].push(entity);
      continue;
    }
    entitiesPerType[type] = [entity];
  }
  return entitiesPerType;
}

export function extractMeta(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): FixedMeta {
  const failed = outputFormatter.calculateFailed(
    resultsByPlugin,
    exceptionsByScanType,
  );
  const fixed = outputFormatter.calculateFixed(resultsByPlugin);

  return { fixed, failed };
}
