import chalk from 'chalk';
import { rightPadWithSpaces } from '../../lib/right-pad';
import { TestOptions, Options } from '../../lib/types';
import { TestResult } from '../../lib/snyk-test/legacy';
import { IacTestResponse } from '../../lib/snyk-test/iac-test-result';
import { capitalizePackageManager } from './iac-output';

export function formatTestMeta(
  res: TestResult | IacTestResponse,
  options: Options & TestOptions,
): string {
  const padToLength = 19; // chars to align
  const packageManager = res.packageManager || options.packageManager;
  const targetFile = res.targetFile || res.displayTargetFile || options.file;
  const openSource = res.isPrivate ? 'no' : 'yes';
  const meta = res.org
    ? [chalk.bold(rightPadWithSpaces('Organization: ', padToLength)) + res.org]
    : [];
  if (options.iac) {
    meta.push(
      chalk.bold(rightPadWithSpaces('Type: ', padToLength)) +
        capitalizePackageManager(packageManager),
    );
  } else {
    meta.push(
      chalk.bold(rightPadWithSpaces('Package manager: ', padToLength)) +
        packageManager,
    );
  }
  if (targetFile) {
    meta.push(
      chalk.bold(rightPadWithSpaces('Target file: ', padToLength)) + targetFile,
    );
  }
  if (res.projectName) {
    meta.push(
      chalk.bold(rightPadWithSpaces('Project name: ', padToLength)) +
        res.projectName,
    );
  }
  if (options.docker) {
    meta.push(
      chalk.bold(rightPadWithSpaces('Docker image: ', padToLength)) +
        options.path,
    );

    if (res.platform) {
      meta.push(
        chalk.bold(rightPadWithSpaces('Platform: ', padToLength)) +
          res.platform,
      );
    }
  } else {
    meta.push(
      chalk.bold(rightPadWithSpaces('Open source: ', padToLength)) + openSource,
    );
    meta.push(
      chalk.bold(rightPadWithSpaces('Project path: ', padToLength)) +
        options.path,
    );
  }
  if (res.payloadType !== 'k8sconfig') {
    const legacyRes: TestResult = res as TestResult;
    if (legacyRes.docker && legacyRes.docker.baseImage) {
      meta.push(
        chalk.bold(rightPadWithSpaces('Base image: ', padToLength)) +
          legacyRes.docker.baseImage,
      );
    }

    if (legacyRes.filesystemPolicy) {
      meta.push(
        chalk.bold(rightPadWithSpaces('Local Snyk policy: ', padToLength)) +
          chalk.green('found'),
      );
      if (
        legacyRes.ignoreSettings &&
        legacyRes.ignoreSettings.disregardFilesystemIgnores
      ) {
        meta.push(
          chalk.bold(
            rightPadWithSpaces('Local Snyk policy ignored: ', padToLength),
          ) + chalk.red('yes'),
        );
      }
    }
    if (legacyRes.licensesPolicy) {
      meta.push(
        chalk.bold(rightPadWithSpaces('Licenses: ', padToLength)) +
          chalk('enabled'),
      );
    }
  }

  return meta.join('\n');
}
