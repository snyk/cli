import * as path from 'path';
import * as debugLib from 'debug';

import {
  ParsedRequirements,
  parseRequirementsFile,
} from './update-dependencies/requirements-file-parser';
import { Workspace } from '../../../../types';
import { containsRequireDirective } from './contains-require-directive';

interface PythonProvenance {
  [fileName: string]: ParsedRequirements;
}

const debug = debugLib('snyk-fix:python:extract-version-provenance');

export async function extractProvenance(
  workspace: Workspace,
  dir: string,
  fileName: string,
  provenance: PythonProvenance = {},
): Promise<PythonProvenance> {
  const requirementsFileName = path.join(dir, fileName);
  const requirementsTxt = await workspace.readFile(requirementsFileName);
  provenance = {
    ...provenance,
    [fileName]: parseRequirementsFile(requirementsTxt),
  };
  const { containsRequire, matches } = await containsRequireDirective(
    requirementsTxt,
  );
  if (containsRequire) {
    for (const match of matches) {
      const requiredFilePath = match[2];
      if (provenance[requiredFilePath]) {
        debug('Detected recursive require directive, skipping');
        continue;
      }

      provenance = {
        ...provenance,
        ...(await extractProvenance(
          workspace,
          dir,
          requiredFilePath,
          provenance,
        )),
      };
    }
  }
  return provenance;
}
