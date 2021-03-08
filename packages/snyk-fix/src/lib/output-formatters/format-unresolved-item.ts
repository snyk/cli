import * as chalk from 'chalk';
import { EntityToFix } from '../../types';
import { PADDING_SPACE } from './show-results-summary';

export function formatUnresolved(
  entity: EntityToFix,
  userMessage: string,
): string {
  return `${PADDING_SPACE}${entity.scanResult.identity.targetFile}\n${PADDING_SPACE}${chalk.red(
    '✖',
  )} ${chalk.red(userMessage)}`;
}
