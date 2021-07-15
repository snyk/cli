import chalk from 'chalk';

import { isLocalFolder } from '../detect';
import { WIZARD_SUPPORTED_PACKAGE_MANAGERS } from '../package-managers';
import { TestResult } from '../snyk-test/legacy';
import { Options, SupportedProjectTypes, TestOptions } from '../types';

export function showFixTip(
  projectType: SupportedProjectTypes,
  res: TestResult,
  options: TestOptions & Options,
): string {
  if (WIZARD_SUPPORTED_PACKAGE_MANAGERS.includes(projectType)) {
    return `Tip: Run ${chalk.bold('`snyk wizard`')} to address these issues.`;
  }

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
      '\nSee documentation on how to enable this beta feature: https://support.snyk.io/hc/en-us/articles/4403417279505-Automatic-remediation-with-snyk-fix'
    );
  }

  return '';
}
