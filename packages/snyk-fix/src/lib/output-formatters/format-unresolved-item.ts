import * as chalk from 'chalk';
import { EntityToFix } from '../../types';
import { PADDING_SPACE } from './show-results-summary';

export function formatUnresolved(
  entity: EntityToFix,
  userMessage: string,
  tip?: string,
): string {
  const name =
    entity.scanResult.identity.targetFile ||
    `${entity.scanResult.identity.type} project`;
  const tipMessage = tip ? `\n${PADDING_SPACE}Tip:     ${tip}` : '';
  const errorMessage = `${PADDING_SPACE}${name}\n${PADDING_SPACE}${chalk.red(
    '✖',
  )} ${chalk.red(userMessage)}`;
  return errorMessage + tipMessage;
}
