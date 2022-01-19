import { AdviseResult } from '../../../lib/advisor/types';
import { CommandResult } from '../types';

export const formatAdviseResult = (result: AdviseResult): CommandResult => {
  return new CommandResult(toPlainText(result))
}

const toPlainText = (result: AdviseResult): string => {
  return result.dependencies
    .map(dep => `${dep.name}: ${100 * dep.score} ${dep.maintenance}`)
    .join('\n');
}
