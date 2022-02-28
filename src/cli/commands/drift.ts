import { MethodArgs } from '../args';
import { processCommandArgs } from './process-command-args';
import {
  runDriftctl,
  parseArgs,
  presentDriftOutput,
} from '../../lib/iac/drift';
import { UnsupportedEntitlementCommandError } from './test/iac-local-execution/assert-iac-options-flag';
import { getIacOrgSettings } from './test/iac-local-execution/measurable-methods';
import config from '../../lib/config';

const legacyError = require('../../lib/errors/legacy-errors');

export default async function drift(...args: MethodArgs): Promise<any> {
  const { options, paths } = processCommandArgs(...args);

  if (options.iac != true) {
    return legacyError('drift');
  }

  const orgPublicId = options.org ?? config.org;
  const iacOrgSettings = await getIacOrgSettings(orgPublicId);

  if (!iacOrgSettings.entitlements?.iacDrift) {
    throw new UnsupportedEntitlementCommandError('drift', 'iacDrift');
  }

  try {
    const args = parseArgs(paths, options);
    const res = await runDriftctl(args);
    await presentDriftOutput(res.stdout, args[0], options);
    process.exit(res.status);
  } catch (e) {
    const err = new Error('Error running `iac drift` ' + e);
    return Promise.reject(err);
  }
}
