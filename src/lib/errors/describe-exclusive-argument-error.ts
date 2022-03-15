import { CustomError } from './custom-error';
import { DescribeExclusiveArgs } from '../iac/drift';

export class DescribeExclusiveArgumentError extends CustomError {
  constructor() {
    super(
      'Please use only one of these arguments: ' +
        DescribeExclusiveArgs.join(', '),
    );
  }
}
