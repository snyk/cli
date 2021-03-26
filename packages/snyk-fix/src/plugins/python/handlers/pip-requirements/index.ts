import * as debugLib from 'debug';
import * as pathLib from 'path';

import {
  DependencyPins,
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
import {
  ParsedRequirements,
  parseRequirementsFile,
  Requirement,
} from './update-dependencies/requirements-file-parser';

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
      const { changes } = await applyAllFixes(
        entity,
        // dir,
        // base,
        // remediation,
        // provenance,
        options,
      );
      if (!changes.length) {
        debug('Manifest has not changed!');
        throw new NoFixesCouldBeAppliedError();
      }
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
  entryFileName: string,
  fileName: string,
  remediation: RemediationChanges,
  parsedRequirements: ParsedRequirements,
  options: FixOptions,
  directUpgradesOnly: boolean,
): Promise<{ changes: FixChangesSummary[]; appliedRemediation: string[] }> {
  const fullFilePath = pathLib.join(dir, fileName);
  const { updatedManifest, changes, appliedRemediation } = updateDependencies(
    parsedRequirements,
    remediation.pin,
    directUpgradesOnly,
    pathLib.join(dir, entryFileName) !== fullFilePath ? fileName : undefined,
  );
  if (!options.dryRun && changes.length > 0) {
    debug('Writing changes to file');
    await workspace.writeFile(pathLib.join(dir, fileName), updatedManifest);
  } else {
    debug('Skipping writing changes to file in --dry-run mode');
  }

  return { changes, appliedRemediation };
}

export async function applyAllFixes(
  entity: EntityToFix,
  options: FixOptions,
): Promise<{ changes: FixChangesSummary[] }> {
  const { remediation, targetFile: entryFileName, workspace } = getRequiredData(
    entity,
  );
  const { dir, base } = pathLib.parse(entryFileName);
  const provenance = await extractProvenance(workspace, dir, base);
  const upgradeChanges: FixChangesSummary[] = [];
  const appliedUpgradeRemediation: string[] = [];
  for (const fileName of Object.keys(provenance)) {
    const skipApplyingPins = true;
    const { changes, appliedRemediation } = await fixIndividualRequirementsTxt(
      workspace,
      dir,
      base,
      fileName,
      remediation,
      provenance[fileName],
      options,
      skipApplyingPins,
    );
    appliedUpgradeRemediation.push(...appliedRemediation);
    // what if we saw the file before and already fixed it?
    upgradeChanges.push(...changes);
  }
  // now do left overs as pins + add tests
  const requirementsTxt = await workspace.readFile(entryFileName);

  const toPin: RemediationChanges = filterOutAppliedUpgrades(
    remediation,
    appliedUpgradeRemediation,
  );
  const directUpgradesOnly = false;
  const { changes: pinnedChanges } = await fixIndividualRequirementsTxt(
    workspace,
    dir,
    base,
    base,
    toPin,
    parseRequirementsFile(requirementsTxt),
    options,
    directUpgradesOnly,
  );

  return { changes: [...upgradeChanges, ...pinnedChanges] };
}

function filterOutAppliedUpgrades(
  remediation: RemediationChanges,
  appliedRemediation: string[],
): RemediationChanges {
  const pinRemediation: RemediationChanges = {
    ...remediation,
    pin: {}, // delete the pin remediation so we can add only not applied
  };
  const pins = remediation.pin;
  const lowerCasedAppliedRemediation = appliedRemediation.map((i) =>
    i.toLowerCase(),
  );
  for (const pkgAtVersion of Object.keys(pins)) {
    if (!lowerCasedAppliedRemediation.includes(pkgAtVersion.toLowerCase())) {
      pinRemediation.pin[pkgAtVersion] = pins[pkgAtVersion];
    }
  }
  return pinRemediation;
}
