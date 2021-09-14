import * as pathLib from 'path';
import * as pipenvPipfileFix from '@snyk/fix-pipenv-pipfile';

import {
  EntityToFix,
  FixChangesSummary,
  FixOptions,
} from '../../../../../types';
import { validateRequiredData } from '../../validate-required-data';

import {
  generateFailedChanges,
  generateSuccessfulChanges,
} from '../../attempted-changes-summary';
import { CommandFailedError } from '../../../../../lib/errors/command-failed-to-run-error';
import { NoFixesCouldBeAppliedError } from '../../../../../lib/errors/no-fixes-applied';

export async function pipenvAdd(
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
