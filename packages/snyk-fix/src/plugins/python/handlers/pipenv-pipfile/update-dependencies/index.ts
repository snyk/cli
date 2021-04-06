import * as pathLib from 'path';
import * as debugLib from 'debug';

import Bottleneck from 'bottleneck';

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
import { execute, ExecuteResponse } from '../../sub-process';
import { validateRequiredData } from '../../validate-required-data';

const debug = debugLib('snyk-fix:python:Pipfile');

interface PipEnvConfig {
  pythonVersion?: '2' | '3';
  command?: string; // use the provided Python interpreter
}

const limiter = new Bottleneck({
  maxConcurrent: 4,
});

const runPipAddLimitedConcurrency = limiter.wrap(runPipEnvInstall);

// TODO: move
// https://pipenv.pypa.io/en/latest/advanced/#changing-default-python-versions
function getPythonversionArgs(config: PipEnvConfig): string | void {
  if (config.command) {
    return '--python'; // Performs the installation in a virtualenv using the provided Python interpreter.
  }
  if (config.pythonVersion === '2') {
    return '--two'; // Performs the installation in a virtualenv using the system python3 link.
  }
  if (config.pythonVersion === '3') {
    return '--three'; // Performs the installation in a virtualenv using the system python2 link.
  }
}

// TODO: move
async function runPipEnvInstall(
  projectPath: string,
  requirements: string[],
  config: PipEnvConfig,
): Promise<ExecuteResponse> {
  const args = ['install', ...requirements];

  const pythonVersionArg = getPythonversionArgs(config);
  if (pythonVersionArg) {
    args.push(pythonVersionArg);
  }

  let res: ExecuteResponse;

  try {
    res = await execute('pipenv', args, { cwd: projectPath });
  } catch (e) {
    debug('Execute failed with', e);
    res = e;
  }

  return res;
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
      const res = await runPipAddLimitedConcurrency(
        dir,
        upgrades,
        {}, // TODO: get the CLI options
      );
      if (res.exitCode !== 0) {
        pipenvCommand = res.command;
        throwPipenvError(res.stderr);
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

function throwPipenvError(stderr: string) {
  const incompatibleDeps =
    'There are incompatible versions in the resolved dependencies';
  const lockingFailed = 'Locking Failed';
  const versionNotFound = 'Could not find a version that matches';
  if (stderr.includes(incompatibleDeps)) {
    throw new CommandFailedError(incompatibleDeps);
  }
  if (stderr.includes(lockingFailed)) {
    throw new CommandFailedError(lockingFailed);
  }
  if (stderr.includes(versionNotFound)) {
    throw new CommandFailedError(versionNotFound);
  }
  throw new NoFixesCouldBeAppliedError();
}
