import chalk from 'chalk';
import { icon } from '../../../theme';
import * as Debug from 'debug';
import * as pathLib from 'path';

import {
  IacTestResponse,
  AnnotatedIacIssue,
} from '../../../../lib/snyk-test/iac-test-result';
import { printPath } from '../../remediation-based-format-issues';
import { titleCaseText } from '../../legacy-format-issue';
import { colorTextBySeverity } from '../../../../lib/snyk-test/common';
import { IacFileInDirectory } from '../../../../lib/types';

import { getSeverityValue } from '../../get-severity-value';

export { formatIacTestSummary } from './test-summary';

const debug = Debug('iac-output');

function formatIacIssue(
  issue: AnnotatedIacIssue,
  isNew: boolean,
  path: string[],
): string {
  const newBadge = isNew ? ' (new)' : '';
  const name = issue.subType ? ` in ${chalk.bold(issue.subType)}` : '';

  let introducedBy = '';
  if (path) {
    // In this mode, we show only one path by default, for compactness
    const pathStr = printPath(path, 0);
    introducedBy = `\n    introduced by ${pathStr}`;
  }

  return (
    colorTextBySeverity(
      issue.severity,
      `  ${icon.ISSUE} ${chalk.bold(issue.title)}${newBadge} [${titleCaseText(
        issue.severity,
      )} Severity]`,
    ) +
    ` [${issue.id}]` +
    name +
    introducedBy +
    '\n'
  );
}

export function getIacDisplayedOutput(
  iacTest: IacTestResponse,
  testedInfoText: string,
  meta: string,
  prefix: string,
): string {
  const issuesTextArray = [
    chalk.bold.white('\nInfrastructure as code issues:'),
  ];

  const NotNew = false;

  const issues: AnnotatedIacIssue[] = iacTest.result.cloudConfigResults;
  debug(`iac display output - ${issues.length} issues`);

  issues
    .sort((a, b) => getSeverityValue(b.severity) - getSeverityValue(a.severity))
    .forEach((issue) => {
      issuesTextArray.push(
        formatIacIssue(issue, NotNew, issue.cloudConfigPath),
      );
    });

  const issuesInfoOutput: string[] = [];
  debug(`Iac display output - ${issuesTextArray.length} issues text`);
  if (issuesTextArray.length > 0) {
    issuesInfoOutput.push(issuesTextArray.join('\n'));
  }

  let body = issuesInfoOutput.join('\n\n') + '\n\n' + meta;

  const vulnCountText = `found ${issues.length} issues`;
  const summary = testedInfoText + ', ' + chalk.red.bold(vulnCountText);

  body = body + '\n\n' + summary;

  return prefix + body;
}

export function getIacDisplayErrorFileOutput(
  iacFileResult: IacFileInDirectory,
): string {
  const fileName = pathLib.basename(iacFileResult.filePath);
  return `

-------------------------------------------------------

Testing ${fileName}...

${iacFileResult.failureReason}`;
}
