import * as chalk from 'chalk';

import { EntityToFix } from '../../../../types';
import { containsRequireDirective } from './contains-require-directive';

interface Supported {
  supported: true;
}

interface NotSupported {
  supported: false;
  reason: string;
}

export function projectTypeSupported(
  res: Supported | NotSupported,
): res is Supported {
  return !('reason' in res);
}

export async function isSupported(
  entity: EntityToFix,
): Promise<Supported | NotSupported> {
  const remediationData = entity.testResult.remediation;

  if (!remediationData) {
    return { supported: false, reason: 'No remediation data available' };
  }
  if (!remediationData.pin || Object.keys(remediationData.pin).length === 0) {
    return {
      supported: false,
      reason: 'There is no actionable remediation to apply',
    };
  }

  // TODO: fix the non null assertion here
  const fileName = entity.scanResult.identity.targetFile!;
  const requirementsTxt = await entity.workspace.readFile(fileName);
  const { containsRequire } = await containsRequireDirective(requirementsTxt);

  if (containsRequire) {
    return {
      supported: false,
      reason: `Requirements with ${chalk.bold('-r')} or ${chalk.bold(
        '-c',
      )} directive are not yet supported`,
    };
  }

  return { supported: true };
}
