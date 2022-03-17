import { CustomError } from './custom-error';
import { DescribeRequiredArgs } from '../iac/drift';

export class DescribeRequiredArgumentError extends CustomError {
  constructor() {
    super(
      'Describe command require one of these arguments: ' +
        DescribeRequiredArgs.join(', '),
    );
  }
}
