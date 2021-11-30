import pathLib from 'path';
import debugLib from 'debug';

import poetryFix from '@snyk/fix-poetry';

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
const debug = debugLib('snyk-fix:python:poetryAdd');

export async function poetryAdd(
  entity: EntityToFix,
  options: FixOptions,
  upgrades: string[],
  dev?: boolean,
): Promise<FixChangesSummary[]> {
  const changes: FixChangesSummary[] = [];
  let poetryCommand;
  const { remediation, targetFile } = validateRequiredData(entity);
  try {
    const targetFilePath = pathLib.resolve(entity.workspace.path, targetFile);
    const { dir } = pathLib.parse(targetFilePath);
    if (!options.dryRun && upgrades.length) {
      const { stderr, stdout, command, exitCode } = await poetryFix.poetryAdd(
        dir,
        upgrades,
        {
          dev,
          python: entity.options.command ?? undefined,
        },
      );
      debug('`poetry add` returned:', { stderr, stdout, command });

      if (exitCode !== 0) {
        poetryCommand = command;
        throwPoetryError(stderr, stdout, command);
      }
    }
    changes.push(...generateSuccessfulChanges(upgrades, remediation.pin));
  } catch (error) {
    changes.push(
      ...generateFailedChanges(upgrades, remediation.pin, error, poetryCommand),
    );
  }
  return changes;
}

function throwPoetryError(stderr: string, stdout: string, command?: string) {
  const ALREADY_UP_TO_DATE = 'No dependencies to install or update';
  const INCOMPATIBLE_PYTHON = new RegExp(
    /Python requirement (.*) is not compatible/g,
    'gm',
  );
  const SOLVER_PROBLEM = /SolverProblemError(.* version solving failed)/gms;

  const incompatiblePythonError =
    INCOMPATIBLE_PYTHON.exec(stderr) || SOLVER_PROBLEM.exec(stdout);
  if (incompatiblePythonError) {
    throw new CommandFailedError(
      `The current project's Python requirement ${incompatiblePythonError[1]} is not compatible with some of the required packages`,
      command,
    );
  }
  const solverProblemError =
    SOLVER_PROBLEM.exec(stderr) || SOLVER_PROBLEM.exec(stdout);
  if (solverProblemError) {
    throw new CommandFailedError(solverProblemError[0].trim(), command);
  }

  if (
    stderr.includes(ALREADY_UP_TO_DATE) ||
    stdout.includes(ALREADY_UP_TO_DATE)
  ) {
    throw new CommandFailedError(
      'No dependencies could be updated as they seem to be at the correct versions. Make sure installed dependencies in the environment match those in the lockfile by running `poetry update`',
      command,
    );
  }
  throw new NoFixesCouldBeAppliedError();
}
