import { IacOutputMeta } from '../../../types';
import { shareResultsOutput } from '../v1';
import { colors } from './utils';

export function formatShareResultsOutput(outputMeta: IacOutputMeta) {
  return colors.info.bold(shareResultsOutput(outputMeta));
}
