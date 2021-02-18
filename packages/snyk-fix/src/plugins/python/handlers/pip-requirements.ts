import * as debugLib from 'debug';
import * as fs from 'fs';

// SCM
// 1. (probably not needed on CLI at all) sanitize => skip anything we don't understand (-r req-dev.txt)
// 2. remediationData applied as upgrade if it's a dep in the file
// 3. remediationData applied as a pin (introduced to the file) if not in the file
// 4. pip check => ok or fail (check step)
// 5. revert back commented out lines

import { EntityToFix, ScanResult } from '../../../types';

const debug = debugLib('snyk-fix:python:requirements.txt');

// v1
// 1. skip if we see `-r re.txt` in file?
// 2. when no -r apply upgrades & pins (make sure file update is function that takes file)

// v2
// version & file provenance to support -r
// apply fixes in relevant files

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
      const res = await fixIndividualRequirementsTxt(entity);
      console.log(res);
      handlerResult.succeeded.push(entity);
    } catch (e) {
      console.error(e); // TODO: use spinner & propagate error back
      handlerResult.failed.push(entity);
    }
  }
  return handlerResult;
}

export async function fixIndividualRequirementsTxt(entity: EntityToFix) {
  const fileName = entity.scanResult.identity.targetFile;
  if (!fileName) {
    // TODO: is this possible?
    throw new Error('Requirements file name required');
  }
  const content = await entity.workspace.readFile(fileName);
  const parsedRequirements = await parseRequirementsTxt(content);
  debug('Parsed manifest ' + parsedRequirements);
  return entity;
}

export async function parseRequirementsTxt(content: string) {
  return JSON.parse(content);
}
