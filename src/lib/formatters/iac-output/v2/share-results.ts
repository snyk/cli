import { IacOutputMeta } from '../../../types';
import { shareResultsOutput } from '../v1';
import { colors } from './color-utils';

export function formatShareResultsOutput(outputMeta: IacOutputMeta) {
  return colors.info.bold(shareResultsOutput(outputMeta));
}
