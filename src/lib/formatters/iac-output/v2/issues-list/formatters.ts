import { FormattedResult } from '../../../../../cli/commands/test/iac/local-execution/types';
import { Results, Vulnerability } from '../../../../iac/test/v2/scan/results';
import { AnnotatedIacIssue } from '../../../../snyk-test/iac-test-result';
import { IacOutputMeta } from '../../../../types';
import { IacTestOutput } from './types';

export function formatScanResultsNewOutput(
  oldFormattedResults: FormattedResult[],
  outputMeta: IacOutputMeta,
): IacTestOutput {
  const newFormattedResults: IacTestOutput = {
    results: {},
    metadata: outputMeta,
  };

  oldFormattedResults.forEach((oldFormattedResult) => {
    oldFormattedResult.result.cloudConfigResults.forEach((issue) => {
      if (!newFormattedResults.results[issue.severity]) {
        newFormattedResults.results[issue.severity] = [];
      }

      newFormattedResults.results[issue.severity].push({
        issue,
        targetFile: oldFormattedResult.targetFile,
        projectType: oldFormattedResult.result.projectType,
      });
    });
  });

  return newFormattedResults;
}

export function formatSnykIacTestScanResultNewOutput(
  snykIacTestScanResult: Results | undefined,
): IacTestOutput {
  const formattedResults: IacTestOutput = {
    results: {},
    // TODO: Add metadata when working on the Share Results feat
    metadata: { projectName: 'TBD', orgName: 'TBD' },
  };

  if (snykIacTestScanResult?.vulnerabilities) {
    snykIacTestScanResult.vulnerabilities.forEach((vulnerability) => {
      if (!formattedResults.results[vulnerability.severity]) {
        formattedResults.results[vulnerability.severity] = [];
      }

      formattedResults.results[vulnerability.severity]!.push({
        issue: formatSnykIacTestScanVulnerability(vulnerability),
        targetFile: vulnerability.resource.file,
        projectType: vulnerability.resource.type,
      });
    });
  }

  return formattedResults;
}

function formatSnykIacTestScanVulnerability(
  vulnerability: Vulnerability,
): AnnotatedIacIssue {
  return {
    id: vulnerability.rule.id,
    severity: vulnerability.severity,
    title: vulnerability.rule.title,
    isIgnored: vulnerability.ignored,
    cloudConfigPath: vulnerability.resource.id
      .split('.')
      .concat(vulnerability.resource.path as string[]),
    subType: '',
    iacDescription: {
      issue: '',
      impact: '',
      resolve: '',
    },
  };
}
