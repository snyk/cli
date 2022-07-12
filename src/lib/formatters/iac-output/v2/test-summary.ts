import { EOL } from 'os';
import { rightPadWithSpaces } from '../../../right-pad';
import { icon } from '../../../theme';
import { IacOutputMeta } from '../../../types';
import { colors } from './utils';
import { IacTestCounts, IacTestData } from './types';

const PAD_LENGTH = 19; // chars to align
const INDENT = '  ';

export function formatIacTestSummary(testData: IacTestData): string {
  const title = colors.title('Test Summary');
  const summarySections: string[] = [title];

  if (testData.metadata) {
    summarySections.push(formatTestMetaSection(testData.metadata));
  }

  summarySections.push(formatCountsSection(testData.counts));

  return summarySections.join(EOL.repeat(2));
}

function formatTestMetaSection(iacMeta: IacOutputMeta): string {
  const metaSectionProperties: [string, string][] = [];

  if (iacMeta.orgName) {
    metaSectionProperties.push(['Organization', iacMeta.orgName]);
  }

  if (iacMeta.projectName) {
    metaSectionProperties.push(['Project name', iacMeta.projectName]);
  }

  const metaSection = metaSectionProperties
    .map(([key, value]) =>
      rightPadWithSpaces(`${INDENT}${key}: ${value}`, PAD_LENGTH),
    )
    .join(EOL);

  return metaSection;
}

function formatCountsSection(testCounts: IacTestCounts): string {
  const countsSectionProperties: string[] = [];

  countsSectionProperties.push(
    `${colors.success.bold(
      icon.VALID,
    )} Files without issues: ${colors.info.bold(
      `${testCounts.filesWithoutIssues}`,
    )}`,
  );

  countsSectionProperties.push(
    `${colors.failure.bold(icon.ISSUE)} Files with issues: ${colors.info.bold(
      `${testCounts.filesWithIssues}`,
    )}`,
  );

  countsSectionProperties.push(
    `${INDENT}Ignored issues: ${colors.info.bold(`${testCounts.ignores}`)}`,
  );

  countsSectionProperties.push(
    `${INDENT}Total issues: ${colors.info.bold(
      `${testCounts.issues}`,
    )} [ ${colors.severities.critical(
      `${testCounts.issuesBySeverity.critical} critical`,
    )}, ${colors.severities.high(
      `${testCounts.issuesBySeverity.high} high`,
    )}, ${colors.severities.medium(
      `${testCounts.issuesBySeverity.medium} medium`,
    )}, ${colors.severities.low(`${testCounts.issuesBySeverity.low} low`)} ]`,
  );

  return countsSectionProperties.join(EOL);
}
