import { TestConfig } from './types';
import * as childProcess from 'child_process';
import { CustomError } from '../../../errors';
import { IaCErrorCodes } from '../../../../cli/commands/test/iac/local-execution/types';
import { getErrorStringCode } from '../../../../cli/commands/test/iac/local-execution/error-utils';
import * as newDebug from 'debug';

const debug = newDebug('snyk-iac');

export function scan(
  options: TestConfig,
  testEnginePath: string,
  rulesBundlePath: string,
): any {
  const args = ['-bundle', rulesBundlePath, ...options.paths];

  const process = childProcess.spawnSync(testEnginePath, args, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  debug('test engine standard error:\n%s', '\n' + process.stderr);

  if (process.status && process.status !== 0) {
    throw new ScanError(`invalid exist status: ${process.status}`);
  }

  if (process.error) {
    throw new ScanError(`spawning process: ${process.error}`);
  }

  let output: any;

  try {
    output = JSON.parse(process.stdout);
  } catch (e) {
    throw new ScanError(`invalid output encoding: ${e}`);
  }

  return output;
}

class ScanError extends CustomError {
  constructor(message: string) {
    super(message);
    this.code = IaCErrorCodes.TestEngineScanError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = 'An error occurred when running the scan';
  }
}
