import chalk, { Chalk, ColorSupport } from 'chalk';
import { SEVERITY } from '../../../snyk-test/common';

export const severityColor: {
  [severity in SEVERITY]: Chalk & {
    supportsColor: ColorSupport;
  };
} = {
  critical: chalk.hex('#AB191A'),
  high: chalk.hex('#CE501A'),
  medium: chalk.hex('#D68000'),
  low: chalk.hex('#88879E'),
};
