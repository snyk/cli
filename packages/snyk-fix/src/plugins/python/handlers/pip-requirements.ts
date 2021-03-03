import * as debugLib from 'debug';
import * as chalk from 'chalk';

import { EntityToFix, FixOptions, WithFixChangesApplied } from '../../../types';
import { PluginFixResponse } from '../../types';
import { updateDependencies } from './update-dependencies';

const debug = debugLib('snyk-fix:python:requirements.txt');

export async function pipRequirementsTxt(
  entities: EntityToFix[],
  options: FixOptions,
): Promise<PluginFixResponse> {
  debug(`Preparing to fix ${entities.length} Python requirements.txt projects`);
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };
  // TODO:
  // find related files
  // process related first
  // process the rest 1 by 1
  for (const entity of entities) {
    try {
      const isSupportedResponse = await isSupported(entity);
      if (projectTypeSupported(isSupportedResponse)) {
        const fixedEntity = await fixIndividualRequirementsTxt(entity, options);
        handlerResult.succeeded.push(fixedEntity);
      } else {
        handlerResult.skipped.push({
          original: entity,
          userMessage: isSupportedResponse.reason,
        });
      }
    } catch (e) {
      handlerResult.failed.push({ original: entity, error: e });
    }
  }
  return handlerResult;
}

function projectTypeSupported(res: Supported | NotSupported): res is Supported {
  return !('reason' in res);
}

interface Supported {
  supported: true;
}

interface NotSupported {
  supported: false;
  reason: string;
}
export async function isSupported(
  entity: EntityToFix,
): Promise<Supported | NotSupported> {
  const remediationData = entity.testResult.remediation;
  if (!remediationData) {
    return { supported: false, reason: 'No remediation data available' };
  }

  if (await containsRequireDirective(entity)) {
    return {
      supported: false,
      reason: `Requirements with ${chalk.bold('-r')} or ${chalk.bold(
        '-c',
      )} directive are not yet supported`,
    };
  }

  if (!remediationData.pin || Object.keys(remediationData.pin).length === 0) {
    return {
      supported: false,
      reason: 'There is no actionable remediation to apply',
    };
  }
  return { supported: true };
}

/* Requires like -r, -c are not supported at the moment, as multiple files
 * would have to be identified and fixed together
 * https://pip.pypa.io/en/stable/reference/pip_install/#options
 */
async function containsRequireDirective(entity: EntityToFix): Promise<boolean> {
  const REQUIRE_PATTERN = /^[^\S\n]*-(r|c)\s+.+/;
  // -r ../base.txt => fileRead('../base.txt');
  // TODO: recursive inclusions?
  // TODO: fix the non null assertion here
  const fileName = entity.scanResult.identity.targetFile!;
  const requirementsTxt = await entity.workspace.readFile(fileName);
  const match = REQUIRE_PATTERN.exec(requirementsTxt);
  if (match && match.length > 1) {
    return true;
  }
  return false;
}

// TODO: optionally verify the deps install
export async function fixIndividualRequirementsTxt(
  entity: EntityToFix,
  options: FixOptions,
): Promise<WithFixChangesApplied<EntityToFix>> {
  const fileName = entity.scanResult.identity.targetFile;
  const remediationData = entity.testResult.remediation;
  if (!remediationData) {
    throw new Error('Fixing is not available without remediation data');
  }
  if (!fileName) {
    throw new Error('Requirements file name required');
  }
  const requirementsTxt = await entity.workspace.readFile(fileName);
  // TODO: allow handlers per fix type (later also strategies or combine with strategies)
  const { updatedManifest, changes } = updateDependencies(
    requirementsTxt,
    remediationData.pin,
  );
  if (!options.dryRun) {
    await entity.workspace.writeFile(fileName, updatedManifest);
  }

  return {
    original: entity,
    changes,
  };
}
