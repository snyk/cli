import { FormattedResult } from '../../../../cli/commands/test/iac/local-execution/types';
import { Results, Vulnerability } from '../../../iac/test/v2/scan/results';
import { AnnotatedIacIssue } from '../../../snyk-test/iac-test-result';
import { SEVERITY } from '../../../snyk-test/legacy';
import { IacOutputMeta } from '../../../types';
import {
  FormattedOutputResultsBySeverity,
  IacTestCounts,
  IacTestData,
} from './types';

interface FormatTestDataParams {
  oldFormattedResults: FormattedResult[];
  iacOutputMeta: IacOutputMeta | undefined;
  ignoresCount: number;
}

export function formatTestData({
  oldFormattedResults,
  iacOutputMeta: iacTestMeta,
  ignoresCount,
}: FormatTestDataParams): IacTestData {
  const resultsBySeverity = formatScanResultsNewOutput(oldFormattedResults);

  return {
    resultsBySeverity,
    metadata: iacTestMeta,
    counts: formatTestCounts(resultsBySeverity, {
      oldFormattedResults,
      ignoresCount,
    }),
  };
}

function formatTestCounts(
  resultsBySeverity: FormattedOutputResultsBySeverity,
  {
    oldFormattedResults,
    ignoresCount,
  }: Pick<FormatTestDataParams, 'ignoresCount' | 'oldFormattedResults'>,
): IacTestCounts {
  const filesWithIssues = oldFormattedResults.filter(
    (result) => result.result.cloudConfigResults.length,
  ).length;

  const filesWithoutIssues = oldFormattedResults.length - filesWithIssues;

  let totalIssues = 0;

  const issuesCountBySeverity = {} as { [key in SEVERITY]: number };
  Object.values(SEVERITY).forEach((severity) => {
    issuesCountBySeverity[severity] = resultsBySeverity[severity]?.length || 0;
    totalIssues += issuesCountBySeverity[severity];
  });

  return {
    ignores: ignoresCount,
    filesWithIssues,
    filesWithoutIssues,
    issuesBySeverity: issuesCountBySeverity,
    issues: totalIssues,
  };
}

function formatScanResultsNewOutput(
  oldFormattedResults: FormattedResult[],
): FormattedOutputResultsBySeverity {
  const newFormattedResults: FormattedOutputResultsBySeverity = {};

  oldFormattedResults.forEach((oldFormattedResult) => {
    oldFormattedResult.result.cloudConfigResults.forEach((issue) => {
      if (!newFormattedResults[issue.severity]) {
        newFormattedResults[issue.severity] = [];
      }

      newFormattedResults[issue.severity].push({
        issue,
        targetFile: oldFormattedResult.targetFile,
        projectType: oldFormattedResult.result.projectType,
      });
    });
  });

  return newFormattedResults;
}

export function formatSnykIacTestTestData(
  snykIacTestScanResult: Results | undefined,
): IacTestData {
  const resultsBySeverity = formatSnykIacTestScanResultNewOutput(
    snykIacTestScanResult,
  );

  let totalIssues = 0;

  const issuesCountBySeverity = {} as { [key in SEVERITY]: number };
  Object.values(SEVERITY).forEach((severity) => {
    issuesCountBySeverity[severity] = resultsBySeverity[severity]?.length || 0;
    totalIssues += issuesCountBySeverity[severity];
  });

  return {
    resultsBySeverity,
    // TODO: Add metadata when working on the Share Results feat
    metadata: { projectName: 'TBD', orgName: 'TBD' },
    // TODO: Add missing preoprties when adding support for the test summary
    counts: {
      ignores: 0,
      filesWithIssues: 0,
      filesWithoutIssues: 0,
      issues: totalIssues,
      issuesBySeverity: issuesCountBySeverity,
    },
  };
}

function formatSnykIacTestScanResultNewOutput(
  snykIacTestScanResult: Results | undefined,
): FormattedOutputResultsBySeverity {
  const resultsBySeverity = {} as FormattedOutputResultsBySeverity;

  if (snykIacTestScanResult?.vulnerabilities) {
    snykIacTestScanResult.vulnerabilities.forEach((vulnerability) => {
      if (!resultsBySeverity[vulnerability.severity]) {
        resultsBySeverity[vulnerability.severity] = [];
      }

      resultsBySeverity[vulnerability.severity]!.push({
        issue: formatSnykIacTestScanVulnerability(vulnerability),
        targetFile: vulnerability.resource.file,
        projectType: vulnerability.resource.type,
      });
    });
  }

  return resultsBySeverity;
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
