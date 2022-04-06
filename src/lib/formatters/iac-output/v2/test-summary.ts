import chalk from 'chalk';
import { EOL } from 'os';
import { rightPadWithSpaces } from '../../../right-pad';
import { SEVERITY } from '../../../snyk-test/common';
import { color, icon } from '../../../theme';
import { IacOutputMeta } from '../../../types';
import { severityColor } from './color-utils';
import { IacTestData } from './types';

const PAD_LENGTH = 19; // chars to align
const INDENT = '  ';

export function formatIacTestSummary(
  testData: IacTestData,
  outputMeta: IacOutputMeta,
): string {
  const title = chalk.bold.white('Test Summary');
  const summarySections: string[] = [title];

  summarySections.push(formatTestMetaSection(outputMeta));

  summarySections.push(formatCountsSection(testData));

  return summarySections.join(EOL.repeat(2));
}

function formatTestMetaSection(iacMeta: IacOutputMeta): string {
  const metaSectionProperties: [string, string][] = [];

  if (iacMeta.orgName) {
    metaSectionProperties.push(['Organization', iacMeta.orgName]);
  }

  const metaSection = metaSectionProperties
    .map(([key, value]) =>
      rightPadWithSpaces(`${INDENT}${key}: ${value}`, PAD_LENGTH),
    )
    .join(EOL);

  return metaSection;
}

function formatCountsSection(testData: IacTestData): string {
  const filesWithIssues = testData.results.filter(
    (result) => result.result.cloudConfigResults.length,
  ).length;
  const filesWithoutIssues = testData.results.length - filesWithIssues;

  const countsSectionProperties: string[] = [];

  countsSectionProperties.push(
    `${chalk.bold(
      color.status.success(icon.VALID),
    )} Files without issues: ${chalk.bold.white(`${filesWithoutIssues}`)}`,
  );

  countsSectionProperties.push(
    `${chalk.bold(
      color.status.error(icon.ISSUE),
    )} Files with issues: ${chalk.bold.white(`${filesWithIssues}`)}`,
  );

  countsSectionProperties.push(
    `${INDENT}Ignored issues: ${chalk.bold.white(`${testData.ignoreCount}`)}`,
  );

  let totalIssuesCount = 0;

  const issueCountsBySeverities: { [key in SEVERITY | 'none']: number } = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    none: 0,
  };

  testData.results.forEach((iacTestResponse) => {
    totalIssuesCount += iacTestResponse.result.cloudConfigResults.length;
    iacTestResponse.result.cloudConfigResults.forEach((iacIssue) => {
      issueCountsBySeverities[iacIssue.severity]++;
    });
  });

  countsSectionProperties.push(
    `${INDENT}Total issues: ${chalk.bold.white(
      `${totalIssuesCount}`,
    )} [ ${severityColor.critical(
      `${issueCountsBySeverities.critical} critical`,
    )}, ${severityColor.high(
      `${issueCountsBySeverities.high} high`,
    )}, ${severityColor.medium(
      `${issueCountsBySeverities.medium} medium`,
    )}, ${severityColor.low(`${issueCountsBySeverities.low} low`)} ]`,
  );

  return countsSectionProperties.join(EOL);
}
