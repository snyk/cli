import * as debugLib from 'debug';
import { EntityToFix } from '../../../types';
import { updateDependencies } from './update-dependencies';

const debug = debugLib('snyk-fix:python:requirements.txt');

export async function pipRequirementsTxt(
  entities: EntityToFix[],
): Promise<{
  succeeded: EntityToFix[];
  failed: EntityToFix[];
  skipped: EntityToFix[];
}> {
  debug(`Preparing to fix ${entities.length} Python requirements.txt projects`);
  const handlerResult: {
    succeeded: EntityToFix[];
    failed: EntityToFix[];
    skipped: EntityToFix[];
  } = {
    succeeded: [],
    failed: [],
    skipped: [],
  };
  for (const entity of entities) {
    try {
      if (await notSupported(entity)) {
        handlerResult.skipped.push(entity);
        continue;
      }
      const fixedEntity = await fixIndividualRequirementsTxt(entity);
      handlerResult.succeeded.push(fixedEntity);
    } catch (e) {
      console.error(e); // TODO: use spinner & propagate error back
      handlerResult.failed.push(entity);
    }
  }
  return handlerResult;
}

export async function notSupported(entity: EntityToFix): Promise<boolean> {
  const remediationData = entity.testResult.remediation;
  if (!remediationData) {
    return true;
  }

  if (await containsRequireDirective(entity)) {
    return true;
  }
  return false;
}

/* Requires like -r, -c are not supported at the moment, as multiple files
 * would have to be identified and fixed together
 * https://pip.pypa.io/en/stable/reference/pip_install/#options
 */
async function containsRequireDirective(entity: EntityToFix): Promise<boolean> {
  const REQUIRE_PATTERN = /^[^\S\n]*-(r|c)\s+.+/;
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
): Promise<EntityToFix> {
  const fileName = entity.scanResult.identity.targetFile;
  const remediationData = entity.testResult.remediation;
  if (!remediationData) {
    throw new Error('Fixing is not available without remediation data');
  }
  if (!fileName) {
    // TODO: is this possible?
    throw new Error('Requirements file name required');
  }
  const requirementsTxt = await entity.workspace.readFile(fileName);
  // TODO: allow handlers per fix type (later also strategies or combine with strategies)
  const fixedRequirementsTxt = updateDependencies(
    requirementsTxt,
    remediationData.pin,
  );
  await entity.workspace.writeFile(fileName, fixedRequirementsTxt);
  // TODO: generate fixes per file + failed per file to generate clear output later
  return entity;
}
