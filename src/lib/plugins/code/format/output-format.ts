import * as Sarif from 'sarif';
import * as Debug from 'debug';
import chalk from 'chalk';
import {
  getLegacySeveritiesColour,
  SEVERITY,
} from '../../../snyk-test/common';

const debug = Debug('code-output');

export function getCodeDisplayedOutput(
  codeTest: Sarif.Log,
  meta: string,
  prefix: string,
) {
  let issues: { [index: string]: string[] } = {
    low: [],
    medium: [],
    high: [],
  };

  if (codeTest.runs[0].results) {
    const results: Sarif.Result[] = codeTest.runs[0].results;

    const rulesMap: {
      [ruleId: string]: Sarif.ReportingDescriptor;
    } = getRulesMap(codeTest.runs[0].tool.driver.rules || []);

    issues = results.reduce((acc, res) => {
      if (res.locations?.length) {
        const location = res.locations[0].physicalLocation;
        if (res.level && location?.artifactLocation && location?.region) {
          const severity = sarifToSeverityLevel(res.level);
          const ruleId = res.ruleId!;
          if (!(ruleId in rulesMap)) {
            debug('Rule ID does not exist in the rules list');
          }
          const ruleName = rulesMap[ruleId].name;
          const ruleIdSeverityText = getLegacySeveritiesColour(
            severity.toLowerCase(),
          ).colorFunc(` ✗ [${severity}] ${ruleName}`);
          const artifactLocationUri = location.artifactLocation.uri;
          const startLine = location.region.startLine;
          const markdown = res.message.markdown;

          const title = ruleIdSeverityText;
          const path = `    Path: ${artifactLocationUri}, line ${startLine}`;
          const info = `    Info: ${markdown}`;
          acc[severity.toLowerCase()].push(
            `${title} \n ${path} \n ${info}\n\n`,
          );
        }
      }
      return acc;
    }, issues);
  }

  const issuesText =
    issues.low.join('') + issues.medium.join('') + issues.high.join('');

  const lowSeverityText = issues.low.length
    ? getLegacySeveritiesColour(SEVERITY.LOW).colorFunc(
      ` ${issues.low.length} [Low] `,
    )
    : '';
  const mediumSeverityText = issues.medium.length
    ? getLegacySeveritiesColour(SEVERITY.MEDIUM).colorFunc(
      ` ${issues.medium.length} [Medium] `,
    )
    : '';
  const highSeverityText = issues.high.length
    ? getLegacySeveritiesColour(SEVERITY.HIGH).colorFunc(
      `${issues.high.length} [High] `,
    )
    : '';

  const vulnPathsText = chalk.green('✔ Awesome! No issues were found.');
  const summaryOKText = chalk.green('✓ Test completed');
  const codeIssueCount =
    issues.low.length + issues.medium.length + issues.high.length;
  const codeIssueFound = `${codeIssueCount} Code issue${codeIssueCount > 0 ? 's' : ''
    } found`;
  const issuesBySeverityText =
    highSeverityText + mediumSeverityText + lowSeverityText;
  const codeIssue =
    codeIssueCount > 0
      ? codeIssueFound + '\n' + issuesBySeverityText
      : vulnPathsText;

  return (
    prefix +
    issuesText +
    '\n' +
    summaryOKText +
    '\n\n' +
    meta +
    '\n\n' +
    codeIssue
  );
}

function getRulesMap(rules: Sarif.ReportingDescriptor[]) {
  const rulesMapByID = rules.reduce((acc, rule) => {
    acc[rule.id] = rule;
    return acc;
  }, {});

  return rulesMapByID;
}

function sarifToSeverityLevel(
  sarifConfigurationLevel: Sarif.ReportingConfiguration.level,
): string {
  const severityLevel = {
    note: 'Low',
    warning: 'Medium',
    error: 'High',
  };

  return severityLevel[sarifConfigurationLevel] as string;
}
