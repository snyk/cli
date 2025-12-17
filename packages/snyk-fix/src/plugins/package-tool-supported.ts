import * as chalk from 'chalk';

import * as pipenvPipfileFix from '@snyk/fix-pipenv-pipfile';
import * as poetryFix from '@snyk/fix-poetry';
import * as npmFix from '@snyk/node-fix';

import * as ora from 'ora';

import { FixOptions } from '../types';

const supportFunc = {
  pipenv: {
    isInstalled: () => pipenvPipfileFix.isPipenvInstalled(),
    isSupportedVersion: (version: string) =>
      pipenvPipfileFix.isPipenvSupportedVersion(version),
  },
  poetry: {
    isInstalled: () => poetryFix.isPoetryInstalled(),
    isSupportedVersion: (version: string) =>
      poetryFix.isPoetrySupportedVersion(version),
  },
  npm: {
    isInstalled: async () => {
      const version = await npmFix.getNpmVersion();
      return { version };
    },
    isSupportedVersion: async (version: string) => {
      const supported = await npmFix.isNpmSupportedVersion();
      return {
        supported,
        versions: [npmFix.MIN_NPM_VERSION],
      };
    },
  },
};

export async function checkPackageToolSupported(
  packageManager: 'pipenv' | 'poetry' | 'npm',
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

  const { supported, versions } =
    await supportFunc[packageManager].isSupportedVersion(version);
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
