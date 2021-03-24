import * as debugLib from 'debug';
import * as pathLib from 'path';

import {
  EntityToFix,
  FixChangesSummary,
  FixOptions,
  RemediationChanges,
  Workspace,
} from '../../../../types';
import { PluginFixResponse } from '../../../types';
import { updateDependencies } from './update-dependencies';
import { MissingRemediationDataError } from '../../../../lib/errors/missing-remediation-data';
import { MissingFileNameError } from '../../../../lib/errors/missing-file-name';
import { partitionByFixable } from './is-supported';
import { NoFixesCouldBeAppliedError } from '../../../../lib/errors/no-fixes-applied';
import {
  extractProvenance,
  PythonProvenance,
} from './extract-version-provenance';

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
      const { remediation, targetFile, workspace } = getRequiredData(entity);
      const { dir, base } = pathLib.parse(targetFile);
      const provenance = await extractProvenance(workspace, dir, base);
      const changes = await fixIndividualRequirementsTxt(
        workspace,
        dir,
        base,
        remediation,
        provenance,
        options,
      );
      handlerResult.succeeded.push({ original: entity, changes });
    } catch (e) {
      handlerResult.failed.push({ original: entity, error: e });
    }
  }
  return handlerResult;
}

export function getRequiredData(
  entity: EntityToFix,
): {
  remediation: RemediationChanges;
  targetFile: string;
  workspace: Workspace;
} {
  const { remediation } = entity.testResult;
  if (!remediation) {
    throw new MissingRemediationDataError();
  }
  const { targetFile } = entity.scanResult.identity;
  if (!targetFile) {
    throw new MissingFileNameError();
  }
  const { workspace } = entity;
  if (!workspace) {
    throw new NoFixesCouldBeAppliedError();
  }
  return { targetFile, remediation, workspace };
}

// TODO: optionally verify the deps install
export async function fixIndividualRequirementsTxt(
  workspace: Workspace,
  dir: string,
  fileName: string,
  remediation: RemediationChanges,
  provenance: PythonProvenance,
  options: FixOptions,
): Promise<FixChangesSummary[]> {
  // TODO: allow handlers per fix type (later also strategies or combine with strategies)
  const { updatedManifest, changes } = updateDependencies(
    provenance[fileName],
    remediation.pin,
  );

  if (!changes.length) {
    debug('Manifest has not changed!');
    throw new NoFixesCouldBeAppliedError();
  }
  if (!options.dryRun) {
    debug('Writing changes to file');
    await workspace.writeFile(pathLib.join(dir, fileName), updatedManifest);
  } else {
    debug('Skipping writing changes to file in --dry-run mode');
  }

  return changes;
}
