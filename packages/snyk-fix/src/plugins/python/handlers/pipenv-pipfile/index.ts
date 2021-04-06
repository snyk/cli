import * as debugLib from 'debug';
import * as ora from 'ora';
import * as chalk from 'chalk';

import { EntityToFix, FixOptions } from '../../../../types';
import { PluginFixResponse } from '../../../types';
import { execute, ExecuteResponse } from '../sub-process';
import { updateDependencies } from './update-dependencies';

const debug = debugLib('snyk-fix:python:Pipfile');

export async function pipenvPipfile(
  fixable: EntityToFix[],
  options: FixOptions,
): Promise<PluginFixResponse> {
  debug(`Preparing to fix ${fixable.length} Python Pipfile projects`);
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };

  await checkPipenvSupport(options);
  for (const [index, entity] of fixable.entries()) {
    const spinner = ora({ isSilent: options.quiet, stream: process.stdout });
    const spinnerMessage = `Fixing Pipfile ${index + 1}/${fixable.length}`;
    spinner.text = spinnerMessage;
    spinner.start();

    const { failed, succeeded, skipped } = await updateDependencies(
      entity,
      options,
    );
    handlerResult.succeeded.push(...succeeded);
    handlerResult.failed.push(...failed);
    handlerResult.skipped.push(...skipped);
    spinner.stop();
  }

  return handlerResult;
}

// TODO: move
async function checkPipenvInstalled(): Promise<{ version: string | null }> {
  let res: ExecuteResponse;
  try {
    res = await execute('pipenv', ['--version'], {});
  } catch (e) {
    debug('Execute failed with', e);
    res = e;
  }
  if (res.exitCode !== 0) {
    throw res.error;
  }

  return { version: extractPipenvVersion(res.stdout) };
}

// TODO: move
function extractPipenvVersion(stdout: string): string | null {
  /* stdout example:
   * pipenv, version 2018.11.26\n
   */
  let version: string | null = null;
  const re = new RegExp(/^pipenv,\sversion\s([0-9.]+)/, 'g');
  const match = re.exec(stdout);
  if (match) {
    version = match[1];
  }
  return version;
}

// TODO: move
function isSupportedPipenvVersion(
  version: string,
): { supported: boolean; versions: string[] } {
  // https://pipenv.pypa.io/en/latest/changelog/
  const SUPPORTED_PIPENV_VERSIONS = [
    '2020.11.4',
    '2020.8.13',
    '2020.6.2',
    '2020.5.28',
    '2018.11.26',
    '2018.11.14',
    '2018.10.13',
    '2018.10.9',
    '2018.7.1',
    '2018.6.25',
  ];
  let supported = false;
  if (SUPPORTED_PIPENV_VERSIONS.includes(version)) {
    supported = true;
  }

  return {
    supported,
    versions: SUPPORTED_PIPENV_VERSIONS,
  };
}

async function checkPipenvSupport(options: FixOptions): Promise<void> {
  const { version } = await checkPipenvInstalled();

  const spinner = ora({ isSilent: options.quiet, stream: process.stdout });
  spinner.clear();
  spinner.text = 'Checking pipenv version';
  spinner.indent = 2;
  spinner.start();

  if (!version) {
    spinner.stopAndPersist({
      text: chalk.hex('#EDD55E')(
        'Could not detect pipenv version, proceeding anyway. Some operations may fail.',
      ),
      symbol: chalk.hex('#EDD55E')('⚠️'),
    });
    return;
  }

  const { supported, versions } = isSupportedPipenvVersion(version);
  if (!supported) {
    const spinnerMessage = ` ${version} pipenv version detected. Currently the following pipenv versions are supported: ${versions.join(
      ',',
    )}`;
    spinner.stopAndPersist({
      text: chalk.hex('#EDD55E')(spinnerMessage),
      symbol: chalk.hex('#EDD55E')('⚠️'),
    });
  } else {
    spinner.stop();
  }
}
