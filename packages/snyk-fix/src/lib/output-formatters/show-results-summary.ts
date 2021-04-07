import * as chalk from 'chalk';

import { FixHandlerResultByPlugin } from '../../plugins/types';
import { ErrorsByEcoSystem } from '../../types';
import { convertErrorToUserMessage } from '../errors/error-to-user-message';
import { formatChangesSummary } from './format-successful-item';
import { formatUnresolved } from './format-unresolved-item';
export const PADDING_SPACE = '  '; // 2 spaces

export async function showResultsSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): Promise<string> {
  const successfulFixesSummary = generateSuccessfulFixesSummary(
    resultsByPlugin,
  );
  const unresolvedSummary = generateUnresolvedSummary(
    resultsByPlugin,
    exceptionsByScanType,
  );
  const overallSummary = generateFixedAndFailedSummary(
    resultsByPlugin,
    exceptionsByScanType,
  );
  return `\n${successfulFixesSummary}${
    unresolvedSummary ? `\n\n${unresolvedSummary}` : ''
  }\n\n${overallSummary}`;
}

export function generateSuccessfulFixesSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
): string {
  const sectionTitle = 'Successful fixes:';
  const formattedTitleHeader = `${chalk.bold(sectionTitle)}`;
  let summary = '';

  for (const plugin of Object.keys(resultsByPlugin)) {
    const fixedSuccessfully = resultsByPlugin[plugin].succeeded;
    if (fixedSuccessfully.length > 0) {
      summary +=
        '\n\n' +
        fixedSuccessfully
          .map((s) => formatChangesSummary(s.original, s.changes))
          .join('\n\n');
    }
  }
  if (summary) {
    return formattedTitleHeader + summary;
  }
  return chalk.red('✖ No successful fixes');
}

export function generateUnresolvedSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): string {
  const sectionTitle = 'Unresolved items:';
  const formattedTitleHeader = `${chalk.bold(sectionTitle)}`;
  let summary = '';

  for (const plugin of Object.keys(resultsByPlugin)) {
    const skipped = resultsByPlugin[plugin].skipped;
    if (skipped.length > 0) {
      summary +=
        '\n\n' +
        skipped
          .map((s) => formatUnresolved(s.original, s.userMessage))
          .join('\n\n');
    }
    const failed = resultsByPlugin[plugin].failed;
    if (failed.length > 0) {
      summary +=
        '\n\n' +
        failed
          .map((s) =>
            formatUnresolved(s.original, convertErrorToUserMessage(s.error)),
          )
          .join('\n\n');
    }
  }

  if (Object.keys(exceptionsByScanType).length) {
    for (const ecosystem of Object.keys(exceptionsByScanType)) {
      const unresolved = exceptionsByScanType[ecosystem];
      summary +=
        '\n\n' +
        unresolved.originals
          .map((s) => formatUnresolved(s, unresolved.userMessage))
          .join('\n\n');
    }
  }
  if (summary) {
    return formattedTitleHeader + summary;
  }
  return '';
}

export function generateFixedAndFailedSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): string {
  const sectionTitle = 'Summary:';
  const formattedTitleHeader = `${chalk.bold(sectionTitle)}`;
  const fixedItems = calculateFixed(resultsByPlugin);
  const failedItems = calculateFailed(resultsByPlugin, exceptionsByScanType);

  return `${formattedTitleHeader}\n\n${PADDING_SPACE}${chalk.bold.red(
    failedItems,
  )} items were not fixed\n${PADDING_SPACE}${chalk.green.bold(
    fixedItems,
  )} items were successfully fixed`;
}

export function calculateFixed(
  resultsByPlugin: FixHandlerResultByPlugin,
): number {
  let fixed = 0;
  for (const plugin of Object.keys(resultsByPlugin)) {
    fixed += resultsByPlugin[plugin].succeeded.length;
  }
  return fixed;
}

export function calculateFailed(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): number {
  let failed = 0;
  for (const plugin of Object.keys(resultsByPlugin)) {
    const results = resultsByPlugin[plugin];
    failed += results.failed.length + results.skipped.length;
  }

  if (Object.keys(exceptionsByScanType).length) {
    for (const ecosystem of Object.keys(exceptionsByScanType)) {
      const unresolved = exceptionsByScanType[ecosystem];
      failed += unresolved.originals.length;
    }
  }
  return failed;
}
