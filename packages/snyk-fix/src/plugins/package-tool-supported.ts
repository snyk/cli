import * as chalk from 'chalk';

import * as pipenvPipfileFix from '@snyk/fix-pipenv-pipfile';
import * as poetryFix from '@snyk/fix-poetry';

import * as ora from 'ora';

import { FixOptions } from '../types';

const supportFunc = {
  pipenv: {
    isInstalled: () => pipenvPipfileFix.isPipenvInstalled(),
    isSupportedVersion: (version) =>
      pipenvPipfileFix.isPipenvSupportedVersion(version),
  },
  poetry: {
    isInstalled: () => poetryFix.isPoetryInstalled(),
    isSupportedVersion: (version) =>
      poetryFix.isPoetrySupportedVersion(version),
  },
};

export async function checkPackageToolSupported(
  packageManager: 'pipenv' | 'poetry',
  options: FixOptions,
): Promise<void> {
  const { version } = await supportFunc[packageManager].isInstalled();

  const spinner = ora({ isSilent: options.quiet, stream: process.stdout });
  spinner.clear();
  spinner.text = `Checking ${packageManager} version`;
  spinner.indent = 2;
  spinner.start();

  if (!version) {
    spinner.stopAndPersist({
      text: chalk.hex('#EDD55E')(
        `Could not detect ${packageManager} version, proceeding anyway. Some operations may fail.`,
      ),
      symbol: chalk.hex('#EDD55E')('⚠️'),
    });
    return;
  }

  const { supported, versions } = supportFunc[
    packageManager
  ].isSupportedVersion(version);
  if (!supported) {
    const spinnerMessage = ` ${version} ${packageManager} version detected. Currently the following ${packageManager} versions are supported: ${versions.join(
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
