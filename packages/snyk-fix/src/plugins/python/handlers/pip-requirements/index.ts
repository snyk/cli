import * as debugLib from 'debug';
import * as pathLib from 'path';

import {
  EntityToFix,
  FixOptions,
  WithFixChangesApplied,
} from '../../../../types';
import { PluginFixResponse } from '../../../types';
import { updateDependencies } from './update-dependencies';
import { MissingRemediationDataError } from '../../../../lib/errors/missing-remediation-data';
import { MissingFileNameError } from '../../../../lib/errors/missing-file-name';
import { partitionByFixable } from './is-supported';
import { NoFixesCouldBeAppliedError } from '../../../../lib/errors/no-fixes-applied';
import { extractProvenance } from './extract-version-provenance';

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

  const { fixable, skipped } = await partitionByFixable(entities);
  handlerResult.skipped.push(...skipped);

  for (const entity of fixable) {
    try {
      const fixedEntity = await fixIndividualRequirementsTxt(entity, options);
      handlerResult.succeeded.push(fixedEntity);
    } catch (e) {
      handlerResult.failed.push({ original: entity, error: e });
    }
  }
  return handlerResult;
}

// TODO: optionally verify the deps install
export async function fixIndividualRequirementsTxt(
  entity: EntityToFix,
  options: FixOptions,
): Promise<WithFixChangesApplied<EntityToFix>> {
  const fileName = entity.scanResult.identity.targetFile;
  const remediationData = entity.testResult.remediation;
  if (!remediationData) {
    throw new MissingRemediationDataError();
  }
  if (!fileName) {
    throw new MissingFileNameError();
  }
  const { dir, base } = pathLib.parse(fileName);
  const versionProvenance = await extractProvenance(
    entity.workspace,
    dir,
    base,
  );
  // TODO: allow handlers per fix type (later also strategies or combine with strategies)
  const { updatedManifest, changes } = updateDependencies(
    versionProvenance[base],
    remediationData.pin,
  );

  if (!changes.length) {
    debug('Manifest has not changed!');
    throw new NoFixesCouldBeAppliedError();
  }
  if (!options.dryRun) {
    debug('Writing changes to file');
    await entity.workspace.writeFile(fileName, updatedManifest);
  } else {
    debug('Skipping writing changes to file in --dry-run mode');
  }

  return {
    original: entity,
    changes,
  };
}
