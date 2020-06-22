import chalk from 'chalk';
import * as Debug from 'debug';
import { Options, TestOptions } from '../../../lib/types';
import { CloudConfigTestResult } from '../../../lib/snyk-test/cloud-config-test-result';
import { getSeverityValue } from './formatters';
import { formatIssue } from './formatters/remediation-based-format-issues';
import { AnnotatedCloudConfigIssue } from '../../../lib/snyk-test/cloud-config-test-result';

const debug = Debug('cloud-config-output');

export function getCloudConfigDisplayedOutput(
  res: CloudConfigTestResult,
  testOptions: Options & TestOptions,
  testedInfoText: string,
  meta: string,
  prefix: string,
): string {
  const issuesTextArray = [
    chalk.bold.white('\nInfrastructure as code issues:'),
  ];

  const NoNote = false;
  const NotNew = false;

  const issues: AnnotatedCloudConfigIssue[] = res.result.cloudConfigResults;
  debug(`iac display output - ${issues.length} issues`);

  issues
    .sort((a, b) => getSeverityValue(b.severity) - getSeverityValue(a.severity))
    .forEach((issue) => {
      const path: string[][] = [issue.cloudConfigPath];
      issuesTextArray.push(
        formatIssue(
          issue.id,
          issue.title,
          issue.severity,
          NotNew,
          issue.subType,
          path,
          testOptions,
          NoNote,
        ),
      );
    });

  const issuesInfoOutput: string[] = [];
  debug(`Cloud Config display output - ${issuesTextArray.length} issues text`);
  if (issuesTextArray.length > 0) {
    issuesInfoOutput.push(issuesTextArray.join('\n'));
  }

  let body = issuesInfoOutput.join('\n\n') + '\n\n' + meta;

  const vulnCountText = `found ${issues.length} issues`;
  const summary = testedInfoText + ', ' + chalk.red.bold(vulnCountText);

  body = body + '\n\n' + summary;

  return prefix + body;
}
