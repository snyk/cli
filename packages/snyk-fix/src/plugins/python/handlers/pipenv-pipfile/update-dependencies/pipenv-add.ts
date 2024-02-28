import * as pathLib from 'path';
import * as pipenvPipfileFix from '@snyk/fix-pipenv-pipfile';
import * as debugLib from 'debug';

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

const debug = debugLib('snyk-fix:python:pipenvAdd');

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
      const {
        stderr,
        stdout,
        command,
        exitCode,
      } = await pipenvPipfileFix.pipenvInstall(dir, upgrades, {
        python: entity.options.command,
      });
      debug('`pipenv add` returned:', { stderr, stdout, command });
      if (exitCode !== 0) {
        pipenvCommand = command;
        throwPipenvError(stderr, stdout, command);
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

function throwPipenvError(stderr: string, stdout: string, command?: string) {
  const incompatibleDeps =
    'There are incompatible versions in the resolved dependencies';
  const lockingFailed = 'Locking failed';
  const versionNotFound = 'Could not find a version that matches';

  const errorsToBubbleUp = [incompatibleDeps, lockingFailed, versionNotFound];

  for (const error of errorsToBubbleUp) {
    if (
      stderr.toLowerCase().includes(error.toLowerCase()) ||
      stdout.toLowerCase().includes(error.toLowerCase())
    ) {
      throw new CommandFailedError(error, command);
    }
  }

  const SOLVER_PROBLEM = /SolverProblemError(.* version solving failed)/gms;
  const solverProblemError =
    SOLVER_PROBLEM.exec(stderr) || SOLVER_PROBLEM.exec(stdout);
  if (solverProblemError) {
    throw new CommandFailedError(solverProblemError[0].trim(), command);
  }

  throw new NoFixesCouldBeAppliedError();
}
