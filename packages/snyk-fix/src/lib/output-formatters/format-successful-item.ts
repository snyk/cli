import * as chalk from 'chalk';

import { EntityToFix, FixChangesSummary } from '../../types';
import { formatDisplayName } from './format-display-name';
import { PADDING_SPACE } from './show-results-summary';

/*
 * Generate formatted output that describes what changes were applied, which failed.
 */
export function formatChangesSummary(
  entity: EntityToFix,
  changes: FixChangesSummary[],
): string {
  return `${PADDING_SPACE}${formatDisplayName(
    entity.workspace.path,
    entity.scanResult.identity,
  )}\n${changes.map((c) => formatAppliedChange(c)).join('\n')}`;
}

function formatAppliedChange(change: FixChangesSummary): string | null {
  if (change.success === true) {
    return `${PADDING_SPACE}${chalk.green('✔')} ${change.userMessage}`;
  }
  if (change.success === false) {
    return `${PADDING_SPACE}${chalk.red('x')} ${chalk.red(
      change.userMessage,
    )}\n${PADDING_SPACE}Reason:${PADDING_SPACE}${change.reason}${
      change.tip ? `.\n${PADDING_SPACE}Tip:     ${change.tip}` : undefined
    }`;
  }
  return '';
}
