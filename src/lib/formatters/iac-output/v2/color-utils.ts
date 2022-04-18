import chalk, { Chalk } from 'chalk';
import { SEVERITY } from '../../../snyk-test/common';

interface IacOutputColors {
  severities: SeverityColor;
  failure: Chalk;
}

type SeverityColor = {
  [severity in SEVERITY]: Chalk;
};

export const colors: IacOutputColors = {
  severities: {
    critical: chalk.hex('#AB191A'),
    high: chalk.hex('#CE501A'),
    medium: chalk.hex('#D68000'),
    low: chalk.hex('#88879E'),
  },
  failure: chalk.hex('#B81415'),
};
