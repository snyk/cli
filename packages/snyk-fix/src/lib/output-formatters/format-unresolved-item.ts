import * as chalk from 'chalk';

import { EntityToFix } from '../../types';
import { formatDisplayName } from './format-display-name';
import { PADDING_SPACE } from './show-results-summary';

export function formatUnresolved(
  entity: EntityToFix,
  userMessage: string,
  tip?: string,
): string {
  const name = formatDisplayName(
    entity.workspace.path,
    entity.scanResult.identity,
  );
  const tipMessage = tip ? `\n${PADDING_SPACE}Tip:     ${tip}` : '';
  const errorMessage = `${PADDING_SPACE}${name}\n${PADDING_SPACE}${chalk.red(
    '✖',
  )} ${chalk.red(userMessage)}`;
  return errorMessage + tipMessage;
}
