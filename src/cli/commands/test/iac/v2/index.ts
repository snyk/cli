import chalk from 'chalk';
import { TestCommandResult } from '../../../types';

export async function test(): Promise<TestCommandResult> {
  let response = '';
  response += chalk.bold.green('new flow for UPE integration - TBC...');
  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    '',
    '',
  );
}
