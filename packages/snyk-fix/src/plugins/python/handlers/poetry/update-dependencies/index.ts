import * as pathLib from 'path';
import * as toml from 'toml';

import * as debugLib from 'debug';
import * as poetryFix from '@snyk/fix-poetry';

import { PluginFixResponse } from '../../../../types';
import {
  DependencyPins,
  EntityToFix,
  FixChangesSummary,
  FixOptions,
} from '../../../../../types';
import { NoFixesCouldBeAppliedError } from '../../../../../lib/errors/no-fixes-applied';
import { CommandFailedError } from '../../../../../lib/errors/command-failed-to-run-error';
import { validateRequiredData } from '../../validate-required-data';
import { standardizePackageName } from '../../../standardize-package-name';

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
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };
  let poetryCommand;
  try {
    const { upgrades, devUpgrades } = await generateUpgrades(entity);
    const { remediation, targetFile } = validateRequiredData(entity);
    const targetFilePath = pathLib.resolve(entity.workspace.path, targetFile);
    const { dir } = pathLib.parse(targetFilePath);
    // TODO: for better support we need to:
    // 1. parse the manifest and extract original requirements, version spec etc
    // 2. swap out only the version and retain original spec
    // 3. re-lock the lockfile

    // update prod dependencies first
    if (!options.dryRun && upgrades.length) {
      const res = await poetryFix.poetryAdd(dir, upgrades, {
        python: entity.options.command ?? undefined,
      });
      if (res.exitCode !== 0) {
        poetryCommand = res.command;
        throwPoetryError(res.stderr ? res.stderr : res.stdout, res.command);
      }
    }

    // update dev dependencies second
    if (!options.dryRun && devUpgrades.length) {
      const res = await poetryFix.poetryAdd(dir, devUpgrades, {
        dev: true,
        python: entity.options.command ?? undefined,
      });
      if (res.exitCode !== 0) {
        poetryCommand = res.command;
        throwPoetryError(res.stderr ? res.stderr : res.stdout, res.command);
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
      tip: poetryCommand ? `Try running \`${poetryCommand}\`` : undefined,
    });
  }
  return handlerResult;
}

function generateSuccessfulChanges(pins: DependencyPins): FixChangesSummary[] {
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

    if (pin.isTransitive) {
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
  const match = INCOMPATIBLE_PYTHON.exec(stderr);
  if (match) {
    throw new CommandFailedError(
      `The current project's Python requirement ${match[1]} is not compatible with some of the required packages`,
      command,
    );
  }
  // TODO: test this
  if (stderr.includes(ALREADY_UP_TO_DATE)) {
    throw new CommandFailedError(
      'No dependencies could be updated as they seem to be at the correct versions. Make sure installed dependencies in the environment match those in the lockfile by running `poetry update`',
      command,
    );
  }
  throw new NoFixesCouldBeAppliedError();
}
