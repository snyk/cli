import { IacFileScanResult, PolicyMetadata } from './types';
import {
  issuesToLineNumbers,
  CloudConfigFileTypes,
} from '@snyk/cloud-config-parser';

export function transformToLegacyResults(
  iacLocalExecutionResults: Array<IacFileScanResult>,
  options: { severityThreshold?: string },
) {
  const iacLocalExecutionGroupedResults = groupMultiDocResults(
    iacLocalExecutionResults,
  );
  return iacLocalExecutionGroupedResults.map((iacScanResult) =>
    iacLocalFileScanToLegacyResult(iacScanResult, options.severityThreshold),
  );
}

function getLegacyFileTypeForLineNumber(
  fileType: string,
): CloudConfigFileTypes {
  switch (fileType) {
    case 'yaml':
    case 'yml':
      return CloudConfigFileTypes.YAML;
    case 'json':
      return CloudConfigFileTypes.JSON;
    default:
      return CloudConfigFileTypes.YAML;
  }
}

function iacLocalFileScanToLegacyResult(
  iacFileScanResult: IacFileScanResult,
  severityThreshold?: string,
) {
  const legacyIssues = iacFileScanResult.violatedPolicies.map((policy) => {
    const cloudConfigPath = iacFileScanResult.docId
      ? [`[DocId:${iacFileScanResult.docId}]`].concat(policy.msg.split('.'))
      : policy.msg.split('.');
    let lineNumber = -1;
    try {
      lineNumber = issuesToLineNumbers(
        iacFileScanResult.fileContent,
        getLegacyFileTypeForLineNumber(iacFileScanResult.fileType),
        cloudConfigPath,
      );
    } catch (err) {
      //
    }

    return {
      ...policy,
      id: policy.publicId,
      from: [],
      name: policy.title,
      cloudConfigPath,
      isIgnored: false,
      iacDescription: {
        issue: policy.issue,
        impact: policy.impact,
        resolve: policy.resolve,
      },
      severity: policy.severity,
      lineNumber: lineNumber,
    };
  });
  return {
    result: {
      cloudConfigResults: filterPoliciesBySeverity(
        legacyIssues,
        severityThreshold,
      ),
    },
    packageManager: 'k8sconfig',
    targetFile: iacFileScanResult.filePath,
  };
}

function groupMultiDocResults(
  scanResults: Array<IacFileScanResult>,
): Array<IacFileScanResult> {
  const groupedData = scanResults.reduce((memo, result) => {
    if (memo[result.filePath]) {
      memo[result.filePath].violatedPolicies = memo[
        result.filePath
      ].violatedPolicies.concat(result.violatedPolicies);
    } else {
      memo[result.filePath] = result;
    }

    return memo;
  }, {} as IacFileScanResult);

  return Object.keys(groupedData).map((k) => groupedData[k]);
}

const SEVERITIES = ['low', 'medium', 'high'];

function filterPoliciesBySeverity(
  violatedPolicies: PolicyMetadata[],
  severityThreshold?: string,
): PolicyMetadata[] {
  if (!severityThreshold || severityThreshold === SEVERITIES[0]) {
    return violatedPolicies;
  }

  const severitiesToInclude = SEVERITIES.slice(
    SEVERITIES.indexOf(severityThreshold),
  );

  return violatedPolicies.filter(
    (policy) => severitiesToInclude.indexOf(policy.severity) > -1,
  );
}
