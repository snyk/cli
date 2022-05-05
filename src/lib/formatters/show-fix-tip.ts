import chalk from 'chalk';

import { isLocalFolder } from '../detect';
import { TestResult } from '../snyk-test/legacy';
import { Options, SupportedProjectTypes, TestOptions } from '../types';

export function showFixTip(
  projectType: SupportedProjectTypes,
  res: TestResult,
  options: TestOptions & Options,
): string {
  const snykFixSupported: SupportedProjectTypes[] = ['pip', 'poetry'];
  if (!snykFixSupported.includes(projectType) || !isLocalFolder(options.path)) {
    return '';
  }

  if (!res.ok && res.vulnerabilities.length > 0) {
    return (
      `Tip: Try ${chalk.bold(
        '`snyk fix`',
      )} to address these issues.${chalk.bold(
        '`snyk fix`',
      )} is a new CLI command in that aims to automatically apply the recommended updates for supported ecosystems.` +
      '\nSee documentation on how to enable this beta feature: https://docs.snyk.io/snyk-cli/fix-vulnerabilities-from-the-cli/automatic-remediation-with-snyk-fix#enabling-snyk-fix'
    );
  }

  return '';
}
