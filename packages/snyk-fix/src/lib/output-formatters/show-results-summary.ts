import * as chalk from 'chalk';

import { FixHandlerResultByPlugin } from '../../plugins/types';
import { ErrorsByEcoSystem } from '../../types';
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
  const overallSummary = '';
  return `${successfulFixesSummary}\n\n${unresolvedSummary}\n\n${overallSummary}`;
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
): string | void {
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

export function generateOverallSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
): string {
  const sectionTitle = 'Successful fixes:';
  const formattedTitleHeader = `${chalk.bold(sectionTitle)}\n\n`;
  let summary = '';

  for (const plugin of Object.keys(resultsByPlugin)) {
    const fixedSuccessfully = resultsByPlugin[plugin].succeeded;
    if (fixedSuccessfully.length > 0) {
      summary += fixedSuccessfully
        .map((s) => formatChangesSummary(s.original, s.changes))
        .join('\n\n');
    }
  }
  if (summary) {
    return formattedTitleHeader + summary;
  }
  return chalk.red('✖ No successful fixes');
}
