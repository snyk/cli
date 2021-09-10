import * as pathLib from 'path';
import * as toml from 'toml';

import * as debugLib from 'debug';
import * as poetryFix from '@snyk/fix-poetry';

import { PluginFixResponse } from '../../../../types';
import {
  EntityToFix,
  FixChangesError,
  FixChangesSummary,
  FixOptions,
} from '../../../../../types';
import { NoFixesCouldBeAppliedError } from '../../../../../lib/errors/no-fixes-applied';
import { CommandFailedError } from '../../../../../lib/errors/command-failed-to-run-error';
import { validateRequiredData } from '../../validate-required-data';
import { standardizePackageName } from '../../../standardize-package-name';
import {
  generateFailedChanges,
  generateSuccessfulChanges,
  isSuccessfulChange,
} from './attempted-changes-summary';

const debug = debugLib('snyk-fix:python:Poetry');

interface PyProjectToml {
  tool: {
    poetry: {
      name: string;
      version: string;
      description: string;
      authors: string[];
      dependencies?: object;
      'dev-dependencies'?: object;
    };
  };
}

export async function updateDependencies(
  entity: EntityToFix,
  options: FixOptions,
): Promise<PluginFixResponse> {
  const handlerResult = await fixAll(entity, options);
  return handlerResult;
}

export async function generateUpgrades(
  entity: EntityToFix,
): Promise<{ upgrades: string[]; devUpgrades: string[] }> {
  const { remediation, targetFile } = validateRequiredData(entity);
  const pins = remediation.pin;

  const targetFilePath = pathLib.resolve(entity.workspace.path, targetFile);
  const { dir } = pathLib.parse(targetFilePath);
  const pyProjectTomlRaw = await entity.workspace.readFile(
    pathLib.resolve(dir, 'pyproject.toml'),
  );
  const pyProjectToml: PyProjectToml = toml.parse(pyProjectTomlRaw);

  const prodTopLevelDeps = Object.keys(
    pyProjectToml.tool.poetry.dependencies ?? {},
  );
  const devTopLevelDeps = Object.keys(
    pyProjectToml.tool.poetry['dev-dependencies'] ?? {},
  );

  const upgrades: string[] = [];
  const devUpgrades: string[] = [];
  for (const pkgAtVersion of Object.keys(pins)) {
    const pin = pins[pkgAtVersion];
    const newVersion = pin.upgradeTo.split('@')[1];
    const [pkgName] = pkgAtVersion.split('@');

    const upgrade = `${standardizePackageName(pkgName)}==${newVersion}`;

    if (pin.isTransitive || prodTopLevelDeps.includes(pkgName)) {
      // transitive and it could have come from a dev or prod dep
      // since we can't tell right now let be pinned into production deps
      upgrades.push(upgrade);
    } else if (prodTopLevelDeps.includes(pkgName)) {
      upgrades.push(upgrade);
    } else if (entity.options.dev && devTopLevelDeps.includes(pkgName)) {
      devUpgrades.push(upgrade);
    } else {
      debug(
        `Could not determine what type of upgrade ${upgrade} is. When choosing between: transitive upgrade, production or dev direct upgrade. `,
      );
    }
  }
  return { upgrades, devUpgrades };
}

function throwPoetryError(stderr: string, command?: string) {
  const ALREADY_UP_TO_DATE = 'No dependencies to install or update';
  const INCOMPATIBLE_PYTHON = new RegExp(
    /Python requirement (.*) is not compatible/g,
    'gm',
  );
  const SOLVER_PROBLEM = /SolverProblemError(.* version solving failed)/gms;

  const incompatiblePythonError = INCOMPATIBLE_PYTHON.exec(stderr);
  if (incompatiblePythonError) {
    throw new CommandFailedError(
      `The current project's Python requirement ${incompatiblePythonError[1]} is not compatible with some of the required packages`,
      command,
    );
  }
  const solverProblemError = SOLVER_PROBLEM.exec(stderr);
  if (solverProblemError) {
    throw new CommandFailedError(solverProblemError[0].trim(), command);
  }

  if (stderr.includes(ALREADY_UP_TO_DATE)) {
    throw new CommandFailedError(
      'No dependencies could be updated as they seem to be at the correct versions. Make sure installed dependencies in the environment match those in the lockfile by running `poetry update`',
      command,
    );
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
  const { upgrades, devUpgrades } = await generateUpgrades(entity);
  // TODO: for better support we need to:
  // 1. parse the manifest and extract original requirements, version spec etc
  // 2. swap out only the version and retain original spec
  // 3. re-lock the lockfile
  const changes: FixChangesSummary[] = [];
  try {
    // update prod dependencies first
    if (upgrades.length) {
      changes.push(...(await poetryAdd(entity, options, upgrades)));
    }

    // update dev dependencies second
    if (devUpgrades.length) {
      const installDev = true;
      changes.push(
        ...(await poetryAdd(entity, options, devUpgrades, installDev)),
      );
    }

    if (!changes.length || !changes.some((c) => isSuccessfulChange(c))) {
      debug('Manifest has not changed as no changes got applied!');
      // throw the first error tip since 100% failed, they all failed with the same
      // error
      const { tip, reason } = changes[0] as FixChangesError;
      throw new NoFixesCouldBeAppliedError(reason, tip);
    }
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
      tip: error.tip,
      error,
    });
  }
  return handlerResult;
}

async function poetryAdd(
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
      const res = await poetryFix.poetryAdd(dir, upgrades, {
        dev,
        python: entity.options.command ?? undefined,
      });
      if (res.exitCode !== 0) {
        poetryCommand = res.command;
        throwPoetryError(res.stderr ? res.stderr : res.stdout, res.command);
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
