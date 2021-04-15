import * as chalk from 'chalk';

import { FixHandlerResultByPlugin } from '../../plugins/types';
import { ErrorsByEcoSystem, Issue, TestResult } from '../../types';
import { convertErrorToUserMessage } from '../errors/error-to-user-message';
import { hasFixableIssues } from '../issues/fixable-issues';
import { getIssueCountBySeverity } from '../issues/issues-by-severity';
import { formatChangesSummary } from './format-successful-item';
import { formatUnresolved } from './format-unresolved-item';
export const PADDING_SPACE = '  '; // 2 spaces

export async function showResultsSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): Promise<string> {
  const successfulFixesSummary = generateSuccessfulFixesSummary(
    resultsByPlugin,
  );
  const {
    summary: unresolvedSummary,
    count: unresolvedCount,
  } = generateUnresolvedSummary(resultsByPlugin, exceptionsByScanType);
  const {
    summary: overallSummary,
    count: changedCount,
  } = generateFixedAndFailedSummary(resultsByPlugin, exceptionsByScanType);

  const vulnsSummary = generateIssueSummary(
    resultsByPlugin,
    exceptionsByScanType,
  );
  const fixedIssuesSummary = `${chalk.bold(
    calculateFixedIssues(resultsByPlugin),
  )} fixed issues`;
  return `\n${successfulFixesSummary}${
    unresolvedSummary ? `\n\n${unresolvedSummary}` : ''
  }${
    unresolvedCount || changedCount
      ? `\n\n${overallSummary}\n${vulnsSummary}\n${PADDING_SPACE}${fixedIssuesSummary}`
      : ''
  }`;
}

export function generateSuccessfulFixesSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
): string {
  const sectionTitle = 'Successful fixes:';
  const formattedTitleHeader = `${chalk.bold(sectionTitle)}`;
  let summary = '';

  for (const plugin of Object.keys(resultsByPlugin)) {
    const fixedSuccessfully = resultsByPlugin[plugin].succeeded;
    if (fixedSuccessfully.length > 0) {
      summary +=
        '\n\n' +
        fixedSuccessfully
          .map((s) => formatChangesSummary(s.original, s.changes))
          .join('\n\n');
    }
  }
  if (summary) {
    return formattedTitleHeader + summary;
  }
  return chalk.red(' ✖ No successful fixes');
}

export function generateUnresolvedSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): { summary: string; count: number } {
  const title = 'Unresolved items:';
  const formattedTitle = `${chalk.bold(title)}`;
  let summary = '';
  let count = 0;

  for (const plugin of Object.keys(resultsByPlugin)) {
    const skipped = resultsByPlugin[plugin].skipped;
    if (skipped.length > 0) {
      count += skipped.length;
      summary +=
        '\n\n' +
        skipped
          .map((s) => formatUnresolved(s.original, s.userMessage))
          .join('\n\n');
    }
    const failed = resultsByPlugin[plugin].failed;
    if (failed.length > 0) {
      count += failed.length;
      summary +=
        '\n\n' +
        failed
          .map((s) =>
            formatUnresolved(s.original, convertErrorToUserMessage(s.error)),
          )
          .join('\n\n');
    }
  }

  if (Object.keys(exceptionsByScanType).length) {
    for (const ecosystem of Object.keys(exceptionsByScanType)) {
      const unresolved = exceptionsByScanType[ecosystem];
      count += unresolved.originals.length;
      summary +=
        '\n\n' +
        unresolved.originals
          .map((s) => formatUnresolved(s, unresolved.userMessage))
          .join('\n\n');
    }
  }
  if (summary) {
    return { summary: formattedTitle + summary, count };
  }
  return { summary: '', count: 0 };
}

export function generateFixedAndFailedSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): { summary: string; count: number } {
  const sectionTitle = 'Summary:';
  const formattedTitleHeader = `${chalk.bold(sectionTitle)}`;
  const fixed = calculateFixed(resultsByPlugin);
  const failed = calculateFailed(resultsByPlugin, exceptionsByScanType);

  return {
    summary: `${formattedTitleHeader}\n\n${PADDING_SPACE}${chalk.bold.red(
      failed,
    )} items were not fixed\n${PADDING_SPACE}${chalk.green.bold(
      fixed,
    )} items were successfully fixed`,
    count: fixed + failed,
  };
}

export function calculateFixed(
  resultsByPlugin: FixHandlerResultByPlugin,
): number {
  let fixed = 0;
  for (const plugin of Object.keys(resultsByPlugin)) {
    fixed += resultsByPlugin[plugin].succeeded.length;
  }
  return fixed;
}

export function calculateFixedIssues(
  resultsByPlugin: FixHandlerResultByPlugin,
): number {
  const fixedIssues: string[] = [];
  for (const plugin of Object.keys(resultsByPlugin)) {
    for (const entity of resultsByPlugin[plugin].succeeded) {
      // count unique vulns fixed per scanned entity
      // some fixed may need to be made in multiple places
      // and would count multiple times otherwise.
      const fixedPerEntity = new Set<string>();
      entity.changes
        .filter((c) => c.success)
        .forEach((c) => {
          c.issueIds.map((i) => fixedPerEntity.add(i));
        });
      fixedIssues.push(...Array.from(fixedPerEntity));
    }
  }

  return fixedIssues.length;
}

export function calculateFailed(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): number {
  let failed = 0;
  for (const plugin of Object.keys(resultsByPlugin)) {
    const results = resultsByPlugin[plugin];
    failed += results.failed.length + results.skipped.length;
  }

  if (Object.keys(exceptionsByScanType).length) {
    for (const ecosystem of Object.keys(exceptionsByScanType)) {
      const unresolved = exceptionsByScanType[ecosystem];
      failed += unresolved.originals.length;
    }
  }
  return failed;
}

export function formatIssueCountBySeverity({
  critical,
  high,
  medium,
  low,
}: {
  [severity: string]: number;
}): string {
  const summary: string[] = [];
  if (critical && critical > 0) {
    summary.push(
      severitiesColourMapping.critical.colorFunc(`${critical} Critical`),
    );
  }
  if (high && high > 0) {
    summary.push(severitiesColourMapping.high.colorFunc(`${high} High`));
  }
  if (medium && medium > 0) {
    summary.push(severitiesColourMapping.medium.colorFunc(`${medium} Medium`));
  }
  if (low && low > 0) {
    summary.push(severitiesColourMapping.low.colorFunc(`${low} Low`));
  }

  return summary.join(' | ');
}

export const severitiesColourMapping: {
  [severity: string]: {
    colorFunc: (arg: string) => string;
  };
} = {
  low: {
    colorFunc(text) {
      return chalk.hex('#BCBBC8')(text);
    },
  },
  medium: {
    colorFunc(text) {
      return chalk.hex('#EDD55E')(text);
    },
  },
  high: {
    colorFunc(text) {
      return chalk.hex('#FF872F')(text);
    },
  },
  critical: {
    colorFunc(text) {
      return chalk.hex('#FF0B0B')(text);
    },
  },
};

export const defaultSeverityColor = {
  colorFunc(text) {
    return chalk.grey(text);
  },
};

export function getSeveritiesColour(severity: string) {
  return severitiesColourMapping[severity] || defaultSeverityColor;
}

export function generateIssueSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): string {
  const testResults: TestResult[] = getTestResults(
    resultsByPlugin,
    exceptionsByScanType,
  );

  const issueData = testResults.map((i) => i.issuesData);
  const bySeverity = getIssueCountBySeverity(issueData);
  const issuesBySeverityMessage = formatIssueCountBySeverity({
    critical: bySeverity.critical.length,
    high: bySeverity.high.length,
    medium: bySeverity.medium.length,
    low: bySeverity.low.length,
  });

  // can't use .flat() or .flatMap() because it's not supported in Node 10
  const issues: Issue[] = [];
  for (const result of testResults) {
    issues.push(...result.issues);
  }

  let totalIssues = `${chalk.bold(issues.length)} total issues`;
  if (issuesBySeverityMessage) {
    totalIssues += `: ${issuesBySeverityMessage}`;
  }

  const { count: fixableCount } = hasFixableIssues(testResults);
  const fixableIssues = `${chalk.bold(fixableCount)} fixable issues`;

  return `${PADDING_SPACE}${totalIssues}\n${PADDING_SPACE}${fixableIssues}`;
}

function getTestResults(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: ErrorsByEcoSystem,
): TestResult[] {
  const testResults: TestResult[] = [];
  for (const plugin of Object.keys(resultsByPlugin)) {
    const { skipped, failed, succeeded } = resultsByPlugin[plugin];
    testResults.push(...skipped.map((i) => i.original.testResult));
    testResults.push(...failed.map((i) => i.original.testResult));
    testResults.push(...succeeded.map((i) => i.original.testResult));
  }

  if (Object.keys(exceptionsByScanType).length) {
    for (const ecosystem of Object.keys(exceptionsByScanType)) {
      const unresolved = exceptionsByScanType[ecosystem];
      testResults.push(...unresolved.originals.map((i) => i.testResult));
    }
  }
  return testResults;
}
