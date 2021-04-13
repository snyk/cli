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
  const {
    summary: unresolvedSummary,
    count: unresolvedCount,
  } = generateUnresolvedSummary(resultsByPlugin, exceptionsByScanType);
  const {
    summary: overallSummary,
    count: changedCount,
  } = generateFixedAndFailedSummary(resultsByPlugin, exceptionsByScanType);
  return `\n${successfulFixesSummary}${
    unresolvedSummary ? `\n\n${unresolvedSummary}` : ''
  }${unresolvedCount || changedCount ? `\n\n${overallSummary}` : ''}`;
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
  return chalk.red(' ✖ No successful fixes');
}

export function generateUnresolvedSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): { summary: string; count: number } {
  const title = 'Unresolved items:';
  const formattedTitle = `${chalk.bold(title)}`;
  let summary = '';
  let count = 0;

  for (const plugin of Object.keys(resultsByPlugin)) {
    const skipped = resultsByPlugin[plugin].skipped;
    if (skipped.length > 0) {
      count += skipped.length;
      summary +=
        '\n\n' +
        skipped
          .map((s) => formatUnresolved(s.original, s.userMessage))
          .join('\n\n');
    }
    const failed = resultsByPlugin[plugin].failed;
    if (failed.length > 0) {
      count += failed.length;
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
      count += unresolved.originals.length;
      summary +=
        '\n\n' +
        unresolved.originals
          .map((s) => formatUnresolved(s, unresolved.userMessage))
          .join('\n\n');
    }
  }
  if (summary) {
    return { summary: formattedTitle + summary, count };
  }
  return { summary: '', count: 0 };
}

export function generateFixedAndFailedSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): { summary: string; count: number } {
  const sectionTitle = 'Summary:';
  const formattedTitleHeader = `${chalk.bold(sectionTitle)}`;
  const fixed = calculateFixed(resultsByPlugin);
  const failed = calculateFailed(resultsByPlugin, exceptionsByScanType);

  return {
    summary: `${formattedTitleHeader}\n\n${PADDING_SPACE}${chalk.bold.red(
      failed,
    )} items were not fixed\n${PADDING_SPACE}${chalk.green.bold(
      fixed,
    )} items were successfully fixed`,
    count: fixed + failed,
  };
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
