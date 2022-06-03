import { CustomError } from './custom-error';
import chalk from 'chalk';

export class DescribeRequiredArgumentError extends CustomError {
  constructor() {
    super(
      chalk.red(
        'Describe command require one of these arguments:\n' +
          '    --only-unmanaged: Report resources not under Terraform control\n' +
          '    --only-managed: Report resources from Terraform states that changed (may take a while)\n' +
          '    --all: Scan for managed and unmanaged resources (may take a while)',
      ),
    );
  }
}
