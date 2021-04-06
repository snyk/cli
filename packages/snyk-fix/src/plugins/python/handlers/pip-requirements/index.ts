import * as debugLib from 'debug';
import * as pathLib from 'path';
const sortBy = require('lodash.sortby');
const groupBy = require('lodash.groupby');

import {
  EntityToFix,
  FixChangesSummary,
  FixOptions,
  Issue,
  RemediationChanges,
  Workspace,
} from '../../../../types';
import { FixedCache, PluginFixResponse } from '../../../types';
import { updateDependencies } from './update-dependencies';
import { partitionByFixable } from './../is-supported';
import { NoFixesCouldBeAppliedError } from '../../../../lib/errors/no-fixes-applied';
import { extractProvenance } from './extract-version-provenance';
import {
  ParsedRequirements,
  parseRequirementsFile,
} from './update-dependencies/requirements-file-parser';
import { standardizePackageName } from './update-dependencies/standardize-package-name';
import { containsRequireDirective } from './contains-require-directive';
import { formatDisplayName } from '../../../../lib/output-formatters/format-display-name';
import { validateRequiredData } from '../validate-required-data';

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

  const { fixable, skipped: notFixable } = await partitionByFixable(entities);
  handlerResult.skipped.push(...notFixable);

  const ordered = sortByDirectory(fixable);
  let fixedFilesCache: FixedCache = {};
  for (const dir of Object.keys(ordered)) {
    debug(`Fixing entities in directory ${dir}`);
    const entitiesPerDirectory = ordered[dir].map((e) => e.entity);
    const { failed, succeeded, skipped, fixedCache } = await fixAll(
      entitiesPerDirectory,
      options,
      fixedFilesCache,
    );
    fixedFilesCache = {
      ...fixedFilesCache,
      ...fixedCache,
    };
    handlerResult.succeeded.push(...succeeded);
    handlerResult.failed.push(...failed);
    handlerResult.skipped.push(...skipped);
  }
  return handlerResult;
}

async function fixAll(
  entities: EntityToFix[],
  options: FixOptions,
  fixedCache: FixedCache,
): Promise<PluginFixResponse & { fixedCache: FixedCache }> {
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };
  for (const entity of entities) {
    const targetFile = entity.scanResult.identity.targetFile!;
    try {
      const { dir, base } = pathLib.parse(targetFile);
      // parse & join again to support correct separator
      const filePath = pathLib.normalize(pathLib.join(dir, base));
      if (
        Object.keys(fixedCache).includes(
          pathLib.normalize(pathLib.join(dir, base)),
        )
      ) {
        handlerResult.succeeded.push({
          original: entity,
          changes: [
            {
              success: true,
              userMessage: `Fixed through ${formatDisplayName(
                entity.workspace.path,
                {
                  type: entity.scanResult.identity.type,
                  targetFile: fixedCache[filePath].fixedIn,
                },
              )}`,
              issueIds: getFixedEntityIssues(
                fixedCache[filePath].issueIds,
                entity.testResult.issues,
              ),
            },
          ],
        });
        continue;
      }
      const { changes, fixedMeta } = await applyAllFixes(entity, options);
      if (!changes.length) {
        debug('Manifest has not changed!');
        throw new NoFixesCouldBeAppliedError();
      }

      // keep fixed issues unique across files that are part of the same project
      // the test result is for 1 entry entity.
      const uniqueIssueIds = new Set<string>();
      for (const c of changes) {
        c.issueIds.map((i) => uniqueIssueIds.add(i));
      }
      Object.keys(fixedMeta).forEach((f) => {
        fixedCache[f] = {
          fixedIn: targetFile,
          issueIds: Array.from(uniqueIssueIds),
        };
      });
      handlerResult.succeeded.push({ original: entity, changes });
    } catch (e) {
      debug(`Failed to fix ${targetFile}.\nERROR: ${e}`);
      handlerResult.failed.push({ original: entity, error: e });
    }
  }
  return { ...handlerResult, fixedCache };
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
): Promise<{ changes: FixChangesSummary[] }> {
  const entryFilePath = pathLib.normalize(pathLib.join(dir, entryFileName));
  const fullFilePath = pathLib.normalize(pathLib.join(dir, fileName));
  const { updatedManifest, changes } = updateDependencies(
    parsedRequirements,
    remediation.pin,
    directUpgradesOnly,
    entryFilePath !== fullFilePath
      ? formatDisplayName(workspace.path, {
          type: 'pip',
          targetFile: fullFilePath,
        })
      : undefined,
  );

  if (!changes.length) {
    return { changes };
  }

  if (!options.dryRun) {
    debug('Writing changes to file');
    await workspace.writeFile(pathLib.join(dir, fileName), updatedManifest);
  } else {
    debug('Skipping writing changes to file in --dry-run mode');
  }

  return { changes };
}

export async function applyAllFixes(
  entity: EntityToFix,
  options: FixOptions,
): Promise<{
  changes: FixChangesSummary[];
  fixedMeta: { [filePath: string]: FixChangesSummary[] };
}> {
  const {
    remediation,
    targetFile: entryFileName,
    workspace,
  } = validateRequiredData(entity);
  const fixedMeta: {
    [filePath: string]: FixChangesSummary[];
  } = {};
  const { dir, base } = pathLib.parse(entryFileName);
  const provenance = await extractProvenance(workspace, dir, base);
  const upgradeChanges: FixChangesSummary[] = [];
  /* Apply all upgrades first across all files that are included */
  for (const fileName of Object.keys(provenance)) {
    const skipApplyingPins = true;
    const { changes } = await fixIndividualRequirementsTxt(
      workspace,
      dir,
      base,
      fileName,
      remediation,
      provenance[fileName],
      options,
      skipApplyingPins,
    );
    upgradeChanges.push(...changes);
    fixedMeta[pathLib.normalize(pathLib.join(dir, fileName))] = upgradeChanges;
  }

  /* Apply all left over remediation as pins in the entry targetFile */
  const toPin: RemediationChanges = filterOutAppliedUpgrades(
    remediation,
    upgradeChanges,
  );
  const directUpgradesOnly = false;
  const fileForPinning = await selectFileForPinning(entity);
  const { changes: pinnedChanges } = await fixIndividualRequirementsTxt(
    workspace,
    dir,
    base,
    fileForPinning.fileName,
    toPin,
    parseRequirementsFile(fileForPinning.fileContent),
    options,
    directUpgradesOnly,
  );

  return { changes: [...upgradeChanges, ...pinnedChanges], fixedMeta };
}

function filterOutAppliedUpgrades(
  remediation: RemediationChanges,
  upgradeChanges: FixChangesSummary[],
): RemediationChanges {
  const pinRemediation: RemediationChanges = {
    ...remediation,
    pin: {}, // delete the pin remediation so we can collect un-applied remediation
  };
  const pins = remediation.pin;
  const normalizedAppliedRemediation = upgradeChanges
    .map((c) => {
      if (c.success && c.from) {
        const [pkgName, versionAndMore] = c.from?.split('@');
        return `${standardizePackageName(pkgName)}@${versionAndMore}`;
      }
      return false;
    })
    .filter(Boolean);
  for (const pkgAtVersion of Object.keys(pins)) {
    const [pkgName, versionAndMore] = pkgAtVersion.split('@');
    if (
      !normalizedAppliedRemediation.includes(
        `${standardizePackageName(pkgName)}@${versionAndMore}`,
      )
    ) {
      pinRemediation.pin[pkgAtVersion] = pins[pkgAtVersion];
    }
  }
  return pinRemediation;
}

function sortByDirectory(
  entities: EntityToFix[],
): {
  [dir: string]: Array<{
    entity: EntityToFix;
    dir: string;
    base: string;
    ext: string;
    root: string;
    name: string;
  }>;
} {
  const mapped = entities.map((e) => ({
    entity: e,
    ...pathLib.parse(e.scanResult.identity.targetFile!),
  }));

  const sorted = sortBy(mapped, 'dir');
  return groupBy(sorted, 'dir');
}

export async function selectFileForPinning(
  entity: EntityToFix,
): Promise<{
  fileName: string;
  fileContent: string;
}> {
  const targetFile = entity.scanResult.identity.targetFile!;
  const { dir, base } = pathLib.parse(targetFile);
  const { workspace } = entity;
  // default to adding pins in the scanned file
  let fileName = base;
  let requirementsTxt = await workspace.readFile(targetFile);

  const { containsRequire, matches } = await containsRequireDirective(
    requirementsTxt,
  );
  const constraintsMatch = matches.filter((m) => m.includes('c'));
  if (containsRequire && constraintsMatch[0]) {
    // prefer to pin in constraints file if present
    fileName = constraintsMatch[0][2];
    requirementsTxt = await workspace.readFile(pathLib.join(dir, fileName));
  }
  return { fileContent: requirementsTxt, fileName };
}

function getFixedEntityIssues(
  fixedIssueIds: string[],
  issues: Issue[],
): string[] {
  const fixed: string[] = [];
  for (const { issueId } of issues) {
    if (fixedIssueIds.includes(issueId)) {
      fixed.push(issueId);
    }
  }
  return fixed;
}
