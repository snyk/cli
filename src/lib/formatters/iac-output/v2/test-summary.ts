import { EOL } from 'os';
import { rightPadWithSpaces } from '../../../right-pad';
import { SEVERITY } from '../../../snyk-test/common';
import { icon } from '../../../theme';
import { IacOutputMeta } from '../../../types';
import { colors } from './color-utils';
import { IacTestData } from './types';

const PAD_LENGTH = 19; // chars to align
const INDENT = '  ';

export function formatIacTestSummary(
  testData: IacTestData,
  outputMeta: IacOutputMeta,
): string {
  const title = colors.info.bold('Test Summary');
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
    `${colors.success.bold(
      icon.VALID,
    )} Files without issues: ${colors.info.bold(`${filesWithoutIssues}`)}`,
  );

  countsSectionProperties.push(
    `${colors.failure.bold(icon.ISSUE)} Files with issues: ${colors.info.bold(
      `${filesWithIssues}`,
    )}`,
  );

  countsSectionProperties.push(
    `${INDENT}Ignored issues: ${colors.info.bold(`${testData.ignoreCount}`)}`,
  );

  let totalIssuesCount = 0;

  const issueCountsBySeverities: { [key in SEVERITY]: number } = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  testData.results.forEach((iacTestResponse) => {
    totalIssuesCount += iacTestResponse.result.cloudConfigResults.length;
    iacTestResponse.result.cloudConfigResults.forEach((iacIssue) => {
      issueCountsBySeverities[iacIssue.severity]++;
    });
  });

  countsSectionProperties.push(
    `${INDENT}Total issues: ${colors.info.bold(
      `${totalIssuesCount}`,
    )} [ ${colors.severities.critical(
      `${issueCountsBySeverities.critical} critical`,
    )}, ${colors.severities.high(
      `${issueCountsBySeverities.high} high`,
    )}, ${colors.severities.medium(
      `${issueCountsBySeverities.medium} medium`,
    )}, ${colors.severities.low(`${issueCountsBySeverities.low} low`)} ]`,
  );

  return countsSectionProperties.join(EOL);
}
