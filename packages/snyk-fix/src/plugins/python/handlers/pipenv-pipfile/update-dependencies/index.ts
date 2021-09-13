import * as pathLib from 'path';
import * as debugLib from 'debug';
import * as pipenvPipfileFix from '@snyk/fix-pipenv-pipfile';

import { PluginFixResponse } from '../../../../types';
import {
  EntityToFix,
  FixChangesSummary,
  FixOptions,
} from '../../../../../types';
import { NoFixesCouldBeAppliedError } from '../../../../../lib/errors/no-fixes-applied';
import { standardizePackageName } from '../../../standardize-package-name';
import { CommandFailedError } from '../../../../../lib/errors/command-failed-to-run-error';
import { validateRequiredData } from '../../validate-required-data';

import {
  generateFailedChanges,
  generateSuccessfulChanges,
} from '../../attempted-changes-summary';
import { ensureHasUpdates } from '../../ensure-has-updates';

const debug = debugLib('snyk-fix:python:Pipfile');

export async function updateDependencies(
  entity: EntityToFix,
  options: FixOptions,
): Promise<PluginFixResponse> {
  const handlerResult = await fixAll(entity, options);
  return handlerResult;
}

export function generateUpgrades(entity: EntityToFix): { upgrades: string[] } {
  const { remediation } = validateRequiredData(entity);
  const { pin: pins } = remediation;

  const upgrades: string[] = [];
  for (const pkgAtVersion of Object.keys(pins)) {
    const pin = pins[pkgAtVersion];
    const newVersion = pin.upgradeTo.split('@')[1];
    const [pkgName] = pkgAtVersion.split('@');
    upgrades.push(`${standardizePackageName(pkgName)}==${newVersion}`);
  }
  return { upgrades };
}

function throwPipenvError(stderr: string, command?: string) {
  const errorStr = stderr.toLowerCase();
  const incompatibleDeps =
    'There are incompatible versions in the resolved dependencies';
  const lockingFailed = 'Locking failed';
  const versionNotFound = 'Could not find a version that matches';

  const errorsToBubbleUp = [incompatibleDeps, lockingFailed, versionNotFound];

  for (const error of errorsToBubbleUp) {
    if (errorStr.includes(error.toLowerCase())) {
      throw new CommandFailedError(error, command);
    }
  }

  const SOLVER_PROBLEM = /SolverProblemError(.* version solving failed)/gms;
  const solverProblemError = SOLVER_PROBLEM.exec(stderr);
  if (solverProblemError) {
    throw new CommandFailedError(solverProblemError[0].trim(), command);
  }

  throw new NoFixesCouldBeAppliedError();
}

async function fixAll(
  entity: EntityToFix,
  options: FixOptions,
): Promise<PluginFixResponse> {
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };
  const { upgrades } = await generateUpgrades(entity);
  if (!upgrades.length) {
    throw new NoFixesCouldBeAppliedError(
      'Failed to calculate package updates to apply',
    );
  }
  const changes: FixChangesSummary[] = [];
  try {
    // TODO: for better support we need to:
    // 1. parse the manifest and extract original requirements, version spec etc
    // 2. swap out only the version and retain original spec
    // 3. re-lock the lockfile
    // Currently this is not possible as there is no Pipfile parser that would do this.
    // update prod dependencies first
    if (upgrades.length) {
      changes.push(...(await pipenvAdd(entity, options, upgrades)));
    }

    ensureHasUpdates(changes);
    handlerResult.succeeded.push({
      original: entity,
      changes,
    });
  } catch (error) {
    debug(
      `Failed to fix ${entity.scanResult.identity.targetFile}.\nERROR: ${error}`,
    );
    handlerResult.failed.push({
      original: entity,
      error,
      tip: error.tip,
    });
  }
  return handlerResult;
}

async function pipenvAdd(
  entity: EntityToFix,
  options: FixOptions,
  upgrades: string[],
): Promise<FixChangesSummary[]> {
  const changes: FixChangesSummary[] = [];
  let pipenvCommand;
  const { remediation, targetFile } = validateRequiredData(entity);
  try {
    const targetFilePath = pathLib.resolve(entity.workspace.path, targetFile);
    const { dir } = pathLib.parse(targetFilePath);
    if (!options.dryRun && upgrades.length) {
      const res = await pipenvPipfileFix.pipenvInstall(dir, upgrades, {
        python: entity.options.command,
      });
      if (res.exitCode !== 0) {
        pipenvCommand = res.command;
        throwPipenvError(res.stderr ? res.stderr : res.stdout, res.command);
      }
    }
    changes.push(...generateSuccessfulChanges(upgrades, remediation.pin));
  } catch (error) {
    changes.push(
      ...generateFailedChanges(upgrades, remediation.pin, error, pipenvCommand),
    );
  }
  return changes;
}
