import { MethodArgs } from '../../args';
import { IaCTestFlags } from '../test/iac-local-execution/types';
import { TestCommandResult } from '../types';
import test from '../test';
import { hasFeatureFlag } from '../../../lib/feature-flags';
import { Options } from '../../../lib/types';
import { UnsupportedFeatureFlagError } from '../../../lib/errors';
import { processCommandArgs } from '../process-command-args';
import { UnsupportedReportCommandError } from './errors/unsupported-report-command';

export default async function report(
  ...args: MethodArgs
): Promise<TestCommandResult> {
  const { paths, options } = processCommandArgs(...args);

  if (options.iac != true) {
    throw new UnsupportedReportCommandError();
  }

  await assertReportSupported(options);

  options.report = true;

  return await test(...paths, options);
}

async function assertReportSupported(options: IaCTestFlags) {
  const isReportSupported = await hasFeatureFlag(
    'iacCliShareResults',
    options as Options,
  );
  if (!isReportSupported) {
    throw new UnsupportedFeatureFlagError('iacCliShareResults');
  }
}
