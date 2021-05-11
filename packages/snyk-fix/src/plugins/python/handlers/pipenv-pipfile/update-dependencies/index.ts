import * as pathLib from 'path';
import * as debugLib from 'debug';
import * as pipenvPipfileFix from '@snyk/fix-pipenv-pipfile';

import { PluginFixResponse } from '../../../../types';
import {
  DependencyPins,
  EntityToFix,
  FixChangesSummary,
  FixOptions,
} from '../../../../../types';
import { NoFixesCouldBeAppliedError } from '../../../../../lib/errors/no-fixes-applied';
import { standardizePackageName } from '../../pip-requirements/update-dependencies/standardize-package-name';
import { CommandFailedError } from '../../../../../lib/errors/command-failed-to-run-error';
import { validateRequiredData } from '../../validate-required-data';
import { convertErrorToUserMessage } from '../../../../../lib/errors/error-to-user-message';

const debug = debugLib('snyk-fix:python:Pipfile');

export async function updateDependencies(
  entity: EntityToFix,
  options: FixOptions,
): Promise<PluginFixResponse> {
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };
  let pipenvCommand;
  try {
    const { remediation, targetFile } = validateRequiredData(entity);
    const { dir } = pathLib.parse(
      pathLib.resolve(entity.workspace.path, targetFile),
    );
    // TODO: for better support we need to:
    // 1. parse the manifest and extract original requirements, version spec etc
    // 2. swap out only the version and retain original spec
    // 3. re-lock the lockfile
    // Currently this is not possible as there is no Pipfile parser that would do this.
    const upgrades = generateUpgrades(remediation.pin);
    if (!options.dryRun) {
      const res = await pipenvPipfileFix.pipenvInstall(
        dir,
        upgrades,
        {
          python: entity.options.command,
        },
      );
      if (res.exitCode !== 0) {
        pipenvCommand = res.command;
        throwPipenvError(res.stderr, res.command);
      }
    }
    const changes = generateSuccessfulChanges(remediation.pin);
    handlerResult.succeeded.push({ original: entity, changes });
  } catch (error) {
    debug(
      `Failed to fix ${entity.scanResult.identity.targetFile}.\nERROR: ${error}`,
    );
    handlerResult.failed.push({
      original: entity,
      error,
      tip: pipenvCommand ? `Try running \`${pipenvCommand}\`` : undefined,
    });
  }
  return handlerResult;
}

export function generateSuccessfulChanges(
  pins: DependencyPins,
): FixChangesSummary[] {
  const changes: FixChangesSummary[] = [];
  for (const pkgAtVersion of Object.keys(pins)) {
    const pin = pins[pkgAtVersion];
    const updatedMessage = pin.isTransitive ? 'Pinned' : 'Upgraded';
    const newVersion = pin.upgradeTo.split('@')[1];
    const [pkgName, version] = pkgAtVersion.split('@');

    changes.push({
      success: true,
      userMessage: `${updatedMessage} ${pkgName} from ${version} to ${newVersion}`,
      issueIds: pin.vulns,
      from: pkgAtVersion,
      to: `${pkgName}@${newVersion}`,
    });
  }
  return changes;
}

export function generateUpgrades(pins: DependencyPins): string[] {
  const upgrades: string[] = [];
  for (const pkgAtVersion of Object.keys(pins)) {
    const pin = pins[pkgAtVersion];
    const newVersion = pin.upgradeTo.split('@')[1];
    const [pkgName] = pkgAtVersion.split('@');
    upgrades.push(`${standardizePackageName(pkgName)}==${newVersion}`);
  }
  return upgrades;
}

function throwPipenvError(stderr: string, command?: string) {
  const errorStr = stderr.toLowerCase();
  const incompatibleDeps =
    'There are incompatible versions in the resolved dependencies';
  const lockingFailed = 'Locking failed';
  const versionNotFound = 'Could not find a version that matches';
  if (stderr.includes(incompatibleDeps.toLocaleLowerCase())) {
    throw new CommandFailedError(incompatibleDeps, command);
  }
  if (errorStr.includes(lockingFailed.toLocaleLowerCase())) {
    throw new CommandFailedError(lockingFailed, command);
  }
  if (stderr.includes(versionNotFound.toLocaleLowerCase())) {
    throw new CommandFailedError(versionNotFound, command);
  }
  throw new NoFixesCouldBeAppliedError();
}
