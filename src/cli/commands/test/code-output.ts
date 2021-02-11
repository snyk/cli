import * as Sarif from 'sarif';
import chalk from 'chalk';

export function getCodeDisplayedOutput(codeTest: Sarif.Log, meta: string, prefix: string) {
  const results = codeTest.runs[0].results;
  let issues: { [index: string]: string[]; } = {
    low: [],
    medium: [],
    high: [],
  };

  if (results) {
    issues = results.reduce((acc, res) => {
      if (res.locations?.length) {
        const location = res.locations[0].physicalLocation;
        if (res.level && location?.artifactLocation && location?.region) {
          const severity = sarifToSeverityLevel(res.level);
          const ruleIdseverityText = severitiesColourMapping[severity].colorFunc(
            ` ✗ [${severity}] ${res.ruleId}`,
          );
          const artifactLocationUri = location.artifactLocation.uri;
          const startLine = location.region.startLine;
          const markdown = res.message.markdown;

          const title = ruleIdseverityText;
          const path = `    Path: ${artifactLocationUri}, line ${startLine}`;
          const info = `    Info: ${markdown}`;
          acc[severity.toLowerCase()].push(`${title} \n ${path} \n ${info}\n\n`);
        }
      }
      return acc;
    }, issues);
  }

  const issuesText = issues.low.join('') + issues.medium.join('') + issues.high.join('');

  const lowSeverityText = issues.low.length ?
    severitiesColourMapping.Low.colorFunc(` ${issues.low.length} [Low] `) : '';
  const mediumSeverityText = issues.medium.length ?
    severitiesColourMapping.Medium.colorFunc(` ${issues.medium.length} [Medium] `) : '';
  const highSeverityText = issues.high.length ?
    severitiesColourMapping.High.colorFunc(`${issues.high.length} [High] `) : '';

  const vulnPathsText = chalk.green('✔ Awesome! No issues were found.');
  const summaryOKText = chalk.green('✓ Test completed');
  const codeIssueCount = issues.low.length + issues.medium.length + issues.high.length;
  const codeIssueFound = `${codeIssueCount} Code issue${codeIssueCount > 0 ? 's' : ''} found`;
  const issuesBySeverityText = highSeverityText + mediumSeverityText + lowSeverityText;
  const codeIssue = codeIssueCount > 0 ? codeIssueFound + '\n' + issuesBySeverityText : vulnPathsText;

  return prefix +
    issuesText +
    '\n' +
    summaryOKText +
    '\n\n' +
    meta +
    '\n\n' +
    codeIssue;
}
// ✗ %s %s %s introduced %s %s
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

const severitiesColourMapping = {
  Low: {
    colorFunc(text) {
      return chalk.blueBright(text);
    },
  },
  Medium: {
    colorFunc(text) {
      return chalk.yellowBright(text);
    },
  },
  High: {
    colorFunc(text) {
      return chalk.redBright(text);
    },
  },
};
