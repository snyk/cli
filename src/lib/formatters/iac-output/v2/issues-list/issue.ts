import * as capitalize from 'lodash.capitalize';
import chalk from 'chalk';
import { EOL } from 'os';
import { iacRemediationTypes } from '../../../../iac/constants';

import { printPath } from '../../../remediation-based-format-issues';
import { colors, contentPadding } from '../utils';
import { FormattedOutputResult } from './types';
import { AnnotatedIacIssue } from '../../../../snyk-test/iac-test-result';

export function formatIssue(result: FormattedOutputResult): string {
  const titleOutput = formatTitle(result.issue);

  const propertiesOutput = formatProperties(result);

  return (
    contentPadding +
    titleOutput +
    EOL +
    contentPadding +
    propertiesOutput.join(EOL + contentPadding)
  );
}

function formatTitle(issue: AnnotatedIacIssue): string {
  const severity = issue.severity;
  const titleOutput = colors.severities[severity](
    `[${capitalize([issue.severity])}] ${chalk.bold(issue.title)}`,
  );

  return titleOutput;
}

function formatInfo(issue: AnnotatedIacIssue): string | undefined {
  const issueDesc = issue.iacDescription.issue;
  const issueImpact = issue.iacDescription.impact;

  if (!issueDesc) {
    return issueImpact;
  }

  if (!issueImpact) {
    return issueDesc;
  }

  return `${issueDesc}${!issueDesc.endsWith('.') ? '.' : ''} ${issueImpact}`;
}

function formatProperties(result: FormattedOutputResult): string[] {
  const remediationKey = iacRemediationTypes?.[result.projectType];

  const properties = [
    ['Info', formatInfo(result.issue)],
    [
      'Rule',
      result.issue.isGeneratedByCustomRule
        ? `custom rule ${result.issue.id}`
        : chalk.underline(result.issue.documentation || ''),
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

  return properties.map(
    ([key, value]) =>
      `${key}: ${' '.repeat(maxPropertyNameLength - key.length)}${value}`,
  );
}
