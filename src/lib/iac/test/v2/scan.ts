import * as childProcess from 'child_process';
import { CustomError } from '../../../errors';
import { IaCErrorCodes } from '../../../../cli/commands/test/iac/local-execution/types';
import { getErrorStringCode } from '../../../../cli/commands/test/iac/local-execution/error-utils';
import * as newDebug from 'debug';

const debug = newDebug('snyk-iac');

export function scan(scanPaths: string[], scanConfig: ScanConfig): any {
  const args = ['-bundle', scanConfig.rulesBundlePath, ...scanPaths];

  const process = childProcess.spawnSync(scanConfig.policyEnginePath, args, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  debug('policy engine standard error:\n%s', '\n' + process.stderr);

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

interface ScanConfig {
  policyEnginePath: string;
  rulesBundlePath: string;
}

class ScanError extends CustomError {
  constructor(message: string) {
    super(message);
    this.code = IaCErrorCodes.PolicyEngineScanError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = 'An error occurred when running the scan';
  }
}
