import * as capitalize from 'lodash.capitalize';
import chalk from 'chalk';
import { EOL } from 'os';
import { iacRemediationTypes } from '../../../../iac/constants';

import { printPath } from '../../../remediation-based-format-issues';
import { colors } from '../color-utils';
import { FormattedOutputResult } from './types';
import { AnnotatedIacIssue } from '../../../../snyk-test/iac-test-result';

export function formatIssue(result: FormattedOutputResult): string {
  const titleOutput = formatTitle(result.issue);

  const propertiesOutput = formatProperties(result);

  return titleOutput + EOL + propertiesOutput;
}

function formatTitle(issue: AnnotatedIacIssue): string {
  const severity = issue.severity;
  const titleOutput = colors.severities[severity](
    `[${capitalize([issue.severity])}] ${chalk.bold(issue.title)}`,
  );

  return titleOutput;
}

function formatProperties(result: FormattedOutputResult): string {
  const remediationKey = iacRemediationTypes?.[result.projectType];

  const properties = [
    [
      'Info',
      `${result.issue.iacDescription.issue}${
        result.issue.iacDescription.issue.endsWith('.') ? '' : '.'
      } ${result.issue.iacDescription.impact}`,
    ],
    [
      'Rule',
      result.issue.isGeneratedByCustomRule
        ? `custom rule ${result.issue.id}`
        : result.issue.documentation,
    ],
    ['Path', printPath(result.issue.cloudConfigPath, 0)],
    ['File', result.targetFile],
    [
      'Resolve',
      remediationKey && result.issue.remediation?.[remediationKey]
        ? result.issue.remediation[remediationKey]
        : result.issue.iacDescription.resolve,
    ],
  ].filter(([, val]) => !!val) as [string, string][];

  const maxPropertyNameLength = Math.max(
    ...properties.map(([key]) => key.length),
  );

  return properties
    .map(
      ([key, value]) =>
        `${key}: ${' '.repeat(maxPropertyNameLength - key.length)}${value}`,
    )
    .join(EOL);
}
