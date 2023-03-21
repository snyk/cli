import { EOL } from 'os';
import * as Sarif from 'sarif';
import * as Debug from 'debug';
import chalk from 'chalk';
import { icon, color } from '../../../theme';
import { colorTextBySeverity, SEVERITY } from '../../../snyk-test/common';
import { rightPadWithSpaces } from '../../../right-pad';
import { Options } from '../../../types';
import { CodeTestResults } from '../types';

const debug = Debug('code-output');

export function getCodeDisplayedOutput(
  testResults: CodeTestResults,
  meta: string,
  prefix: string,
): string {
  let issues: { [index: string]: string[] } = {};

  const sarif = testResults.analysisResults.sarif;
  if (sarif.runs[0].results) {
    const results: Sarif.Result[] = sarif.runs[0].results;

    const rulesMap: {
      [ruleId: string]: Sarif.ReportingDescriptor;
    } = getRulesMap(sarif.runs[0].tool.driver.rules || []);

    issues = getIssues(results, rulesMap);
  }

  const issuesText =
    issues.low.join('') + issues.medium.join('') + issues.high.join('');
  const summaryOKText = color.status.success(`${icon.VALID} Test completed`);
  const codeIssueSummary = getCodeIssuesSummary(issues);

  let summary =
    prefix +
    issuesText +
    '\n' +
    summaryOKText +
    '\n\n' +
    meta +
    '\n\n' +
    chalk.bold('Summary:') +
    '\n\n' +
    codeIssueSummary +
    '\n\n';

  if (testResults.reportResults) {
    summary +=
      getCodeReportDisplayedOutput(testResults.reportResults.reportUrl) +
      '\n\n';
  }

  return summary;
}

function getCodeIssuesSummary(issues: { [index: string]: string[] }): string {
  const lowSeverityText = issues.low.length
    ? colorTextBySeverity(SEVERITY.LOW, `  ${issues.low.length} [Low] `)
    : '';
  const mediumSeverityText = issues.medium.length
    ? colorTextBySeverity(
        SEVERITY.MEDIUM,
        `  ${issues.medium.length} [Medium] `,
      )
    : '';
  const highSeverityText = issues.high.length
    ? colorTextBySeverity(SEVERITY.HIGH, `  ${issues.high.length} [High] `)
    : '';

  const codeIssueCount =
    issues.low.length + issues.medium.length + issues.high.length;
  const codeIssueFound = `  ${codeIssueCount} Code issue${
    codeIssueCount > 0 ? 's' : ''
  } found`;
  const issuesBySeverityText =
    highSeverityText + mediumSeverityText + lowSeverityText;
  const vulnPathsText = color.status.success(
    `${icon.VALID} Awesome! No issues were found.`,
  );

  return codeIssueCount > 0
    ? codeIssueFound + '\n' + issuesBySeverityText
    : vulnPathsText;
}

function getIssues(
  results: Sarif.Result[],
  rulesMap: { [ruleId: string]: Sarif.ReportingDescriptor },
): { [index: string]: string[] } {
  const issuesInit: { [index: string]: string[] } = {
    low: [],
    medium: [],
    high: [],
  };

  const issues = results.reduce((acc, res) => {
    if (res.locations?.length) {
      const location = res.locations[0].physicalLocation;
      if (res.level && location?.artifactLocation && location?.region) {
        const severity = sarifToSeverityLevel(res.level);
        const ruleId = res.ruleId!;
        if (!(ruleId in rulesMap)) {
          debug('Rule ID does not exist in the rules list');
        }
        const ruleName =
          rulesMap[ruleId].shortDescription?.text ||
          rulesMap[ruleId].name ||
          '';
        const ruleIdSeverityText = colorTextBySeverity(
          severity,
          ` ${icon.ISSUE} [${severity}] ${chalk.bold(ruleName)}`,
        );
        const artifactLocationUri = location.artifactLocation.uri;
        const startLine = location.region.startLine;
        const text = res.message.text;
        let title = ruleIdSeverityText;
        if (res.fingerprints?.['identity']) {
          title += `\n   ID: ${res.fingerprints['identity']}`;
        }
        const path = `  Path: ${artifactLocationUri}, line ${startLine}`;
        const info = `  Info: ${text}`;
        acc[severity.toLowerCase()].push(`${title} \n ${path} \n ${info}\n\n`);
      }
    }
    return acc;
  }, issuesInit);

  return issues;
}

function getRulesMap(
  rules: Sarif.ReportingDescriptor[],
): { [ruleId: string]: Sarif.ReportingDescriptor } {
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

export function getMeta(options: Options, path: string): string {
  const padToLength = 19; // chars to align
  const orgName = options.org || '';
  const projectPath = options.path || path;
  const meta = [
    rightPadWithSpaces('Organization: ', padToLength) + chalk.bold(orgName),
  ];
  meta.push(
    rightPadWithSpaces('Test type: ', padToLength) +
      chalk.bold('Static code analysis'),
  );
  meta.push(
    rightPadWithSpaces('Project path: ', padToLength) + chalk.bold(projectPath),
  );

  return meta.join('\n');
}

export function getPrefix(path: string): string {
  return chalk.bold.white('\nTesting ' + path + ' ...\n\n');
}

export function getCodeReportDisplayedOutput(reportUrl: string): string {
  return (
    chalk.bold('Code Report Complete') +
    EOL +
    EOL +
    'Your test results are available at:' +
    EOL +
    chalk.bold(reportUrl)
  );
}
