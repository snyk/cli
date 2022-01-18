import { AdviseResult } from './types';
import { CommandResult } from '../types';

export const formatAdviseResult = (result: AdviseResult): CommandResult => {
  return new CommandResult(toPlainText(result))
}

const toPlainText = (result: AdviseResult): string => {
  return result.dependencies
    .map(dep => `${dep.name}: ${dep.score}`)
    .join('\n');
}
