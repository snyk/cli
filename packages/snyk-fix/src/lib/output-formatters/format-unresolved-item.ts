import * as chalk from 'chalk';
import { EntityToFix } from '../../types';
import { PADDING_SPACE } from './show-results-summary';

export function formatUnresolved(
  entity: EntityToFix,
  userMessage: string,
): string {
  const name =
    entity.scanResult.identity.targetFile ||
    `${entity.scanResult.identity.type} project`;
  return `${PADDING_SPACE}${name}\n${PADDING_SPACE}${chalk.red(
    '✖',
  )} ${chalk.red(userMessage)}`;
}
