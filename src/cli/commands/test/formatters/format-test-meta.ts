import chalk from 'chalk';
import { rightPadWithSpaces } from '../../../../lib/right-pad';
import { TestOptions, Options } from '../../../../lib/types';
import { TestResult } from '../../../../lib/snyk-test/legacy';

export function formatTestMeta(
  res: TestResult,
  options: Options & TestOptions,
): string {
  const padToLength = 19; // chars to align
  const packageManager = res.packageManager || options.packageManager;
  const targetFile = res.targetFile || res.displayTargetFile || options.file;
  const openSource = res.isPrivate ? 'no' : 'yes';
  const meta = [
    chalk.bold(rightPadWithSpaces('Organization: ', padToLength)) + res.org,
    chalk.bold(rightPadWithSpaces('Package manager: ', padToLength)) +
      packageManager,
  ];
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
  } else {
    meta.push(
      chalk.bold(rightPadWithSpaces('Open source: ', padToLength)) + openSource,
    );
    meta.push(
      chalk.bold(rightPadWithSpaces('Project path: ', padToLength)) +
        options.path,
    );
  }
  if (res.docker && res.docker.baseImage) {
    meta.push(
      chalk.bold(rightPadWithSpaces('Base image: ', padToLength)) +
        res.docker.baseImage,
    );
  }

  if (res.filesystemPolicy) {
    meta.push(
      chalk.bold(rightPadWithSpaces('Local Snyk policy: ', padToLength)) +
        chalk.green('found'),
    );
    if (res.ignoreSettings && res.ignoreSettings.disregardFilesystemIgnores) {
      meta.push(
        chalk.bold(
          rightPadWithSpaces('Local Snyk policy ignored: ', padToLength),
        ) + chalk.red('yes'),
      );
    }
  }
  if (res.licensesPolicy) {
    meta.push(
      chalk.bold(rightPadWithSpaces('Licenses: ', padToLength)) +
        chalk.green('enabled'),
    );
  }

  return meta.join('\n');
}
