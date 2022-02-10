import { MethodArgs } from '../args';
import { processCommandArgs } from './process-command-args';
import {
  driftctl,
  DriftCTLOptions,
  DriftCTLResult,
  parseArgs,
} from '../../lib/iac/drift';
import { UnsupportedEntitlementCommandError } from './test/iac-local-execution/assert-iac-options-flag';
import { getIacOrgSettings } from './test/iac-local-execution/measurable-methods';
import config from '../../lib/config';
import { testDrifts } from '../../lib/iac/drift-test';
import { TestCommandResult } from './types';

const legacyError = require('../../lib/errors/legacy-errors');

export default async function drift(
  ...args: MethodArgs
): Promise<TestCommandResult | void> {
  const { options, paths } = processCommandArgs<DriftCTLOptions>(...args);

  if (options.iac != true) {
    return legacyError('drift');
  }

  const orgPublicId = options.org ?? config.org;
  const iacOrgSettings = await getIacOrgSettings(orgPublicId);

  if (!iacOrgSettings.entitlements?.iacDrift) {
    throw new UnsupportedEntitlementCommandError('drift', 'iacDrift');
  }

  let result: DriftCTLResult;
  try {
    let opt = options;
    let isTestSubCommand = false;
    if (paths[0] === 'test') {
      opt = { ...opt, deep: true, output: 'plan://stdout' };
      isTestSubCommand = true;
    }

    const args = parseArgs(paths, opt);
    result = await driftctl(args, isTestSubCommand);
  } catch (e) {
    const err = new Error('Error running `iac drift` ' + e);
    return Promise.reject(err);
  }

  if (result.stderr) {
    throw new Error(result.stderr);
  }
  if (result.stdout) {
    return testDrifts(result.stdout, options, iacOrgSettings);
  }
  process.exit(result.returnCode);
}
