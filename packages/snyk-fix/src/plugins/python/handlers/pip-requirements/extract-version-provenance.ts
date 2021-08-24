import * as path from 'path';
import * as debugLib from 'debug';

import {
  ParsedRequirements,
  parseRequirementsFile,
} from './update-dependencies/requirements-file-parser';
import { Workspace } from '../../../../types';
import { containsRequireDirective } from './contains-require-directive';

export interface PythonProvenance {
  [fileName: string]: ParsedRequirements;
}

const debug = debugLib('snyk-fix:python:extract-version-provenance');

export async function extractProvenance(
  workspace: Workspace,
  rootDir: string,
  dir: string,
  fileName: string,
  provenance: PythonProvenance = {},
): Promise<PythonProvenance> {
  const requirementsFileName = path.join(dir, fileName);
  const requirementsTxt = await workspace.readFile(requirementsFileName);
  // keep all provenance paths with `/` as a separator
  const relativeTargetFileName = path
    .normalize(path.relative(rootDir, requirementsFileName))
    .replace(path.sep, '/');
  provenance = {
    ...provenance,
    [relativeTargetFileName]: parseRequirementsFile(requirementsTxt),
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

      const { dir: requireDir, base } = path.parse(
        path.join(dir, requiredFilePath),
      );

      provenance = {
        ...provenance,
        ...(await extractProvenance(
          workspace,
          rootDir,
          requireDir,
          base,
          provenance,
        )),
      };
    }
  }
  return provenance;
}
