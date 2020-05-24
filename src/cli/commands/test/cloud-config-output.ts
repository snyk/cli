import * as _ from '@snyk/lodash';
import chalk from 'chalk';
import * as Debug from 'debug';
import { Options, TestOptions } from '../../../lib/types';
import { CloudConfigTestResult } from '../../../lib/snyk-test/legacy';
import { getSeverityValue } from './formatters';
import { formatIssue } from './formatters/remediation-based-format-issues';

//TODO(orka): use debug
const debug = Debug('cloud-config-output');

export function getCloudConfigDisplayedOutput(
  res: CloudConfigTestResult,
  testOptions: Options & TestOptions,
  testedInfoText: string,
  meta: string,
  prefix: string,
  multiProjAdvice: string,
): string {
  const issuesTextArray = [chalk.bold.white('\nCloud Configuration issues:')];

  const NoNote = false;
  const NotNew = false;

  const issues = (res as any).result.cloudConfigResults;

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
          'Deployment', // `${issue.packageName}@${issue.version}`,
          path,
          testOptions,
          NoNote,
          [],
          issue.reachability,
        ),
      );
    });

  const issuesInfoOutput: string[] = [];
  if (issuesTextArray.length > 0) {
    issuesInfoOutput.push(issuesTextArray.join('\n'));
  }

  let body = issuesInfoOutput.join('\n\n') + '\n\n' + meta;

  const vulnCountText = `found ${issues.length} issues`;
  const summary = testedInfoText + ', ' + chalk.red.bold(vulnCountText);

  body = body + '\n\n' + summary;

  return prefix + body + multiProjAdvice;
}
