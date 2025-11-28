import { MethodArgs } from '../args';
import { formatTestOutput } from './test/format';
import { TestCommandResult } from './types';

export default async function format(
  ...args: MethodArgs
): Promise<TestCommandResult> {
  return await formatTestOutput(...args);
}
