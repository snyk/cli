import chalk, { Chalk } from 'chalk';
import { SEVERITY } from '../../../snyk-test/common';

interface IacOutputColors {
  severities: SeverityColor;
  failure: Chalk;
  warning: Chalk;
  success: Chalk;
  info: Chalk;
  title: Chalk;
  suggestion: Chalk;
}

type SeverityColor = {
  [severity in SEVERITY]: Chalk;
};

export const colors: IacOutputColors = {
  severities: {
    critical: chalk.magenta,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.reset,
  },
  failure: chalk.red,
  warning: chalk.yellow,
  success: chalk.green,
  info: chalk.reset,
  title: chalk.reset.bold,
  suggestion: chalk.gray,
};

export const contentPadding = ' '.repeat(2);

export const maxLineWidth = process.stdout.columns
  ? Math.min(process.stdout.columns, 80)
  : 80;

export const countSuppressedIssues = (
  suppressedIssues: Record<string, string[]>,
): number => {
  return Object.values(suppressedIssues).reduce(function (
    count,
    resourcesForRuleId,
  ) {
    return (count += resourcesForRuleId.length);
  }, 0);
};
