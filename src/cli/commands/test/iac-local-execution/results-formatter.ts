import {
  EngineType,
  FormattedResult,
  IaCErrorCodes,
  IacFileScanResult,
  IaCTestFlags,
  PolicyMetadata,
  TestMeta,
} from './types';
import * as path from 'path';
import { SEVERITY } from '../../../../lib/snyk-test/common';
import { IacProjectType } from '../../../../lib/iac/constants';
import { CustomError } from '../../../../lib/errors';
import { extractLineNumber } from './extract-line-number';
import { getErrorStringCode } from './error-utils';

const SEVERITIES = [SEVERITY.LOW, SEVERITY.MEDIUM, SEVERITY.HIGH];

export function formatScanResults(
  scanResults: IacFileScanResult[],
  options: IaCTestFlags,
  meta: TestMeta,
): FormattedResult[] {
  try {
    // Relevant only for multi-doc yaml files
    const scannedResultsGroupedByDocId = groupMultiDocResults(scanResults);
    return scannedResultsGroupedByDocId.map((iacScanResult) =>
      formatScanResult(iacScanResult, meta, options),
    );
  } catch (e) {
    throw new FailedToFormatResults();
  }
}

const engineTypeToProjectType = {
  [EngineType.Kubernetes]: IacProjectType.K8S,
  [EngineType.Terraform]: IacProjectType.TERRAFORM,
  [EngineType.Custom]: IacProjectType.CUSTOM,
};

function formatScanResult(
  scanResult: IacFileScanResult,
  meta: TestMeta,
  { severityThreshold, json, sarif }: IaCTestFlags,
): FormattedResult {
  const formattedIssues = scanResult.violatedPolicies.map((policy) => {
    const cloudConfigPath =
      scanResult.docId !== undefined
        ? [`[DocId:${scanResult.docId}]`].concat(policy.msg.split('.'))
        : policy.msg.split('.');

    const shouldExtractLineNumber = json || sarif;
    const lineNumber: number = shouldExtractLineNumber
      ? extractLineNumber(scanResult, policy)
      : -1;

    return {
      ...policy,
      id: policy.publicId,
      name: policy.title,
      cloudConfigPath,
      isIgnored: false,
      iacDescription: {
        issue: policy.issue,
        impact: policy.impact,
        resolve: policy.resolve,
      },
      severity: policy.severity,
      lineNumber,
      documentation: `https://snyk.io/security-rules/${policy.publicId}`,
    };
  });

  const targetFilePath = path.resolve(scanResult.filePath, '.');

  return {
    result: {
      cloudConfigResults: filterPoliciesBySeverity(
        formattedIssues,
        severityThreshold,
      ),
      projectType: scanResult.projectType,
    },
    meta: {
      ...meta,
      projectId: '', // we do not have a project at this stage
      policy: '', // we do not have the concept of policy
    },
    filesystemPolicy: false, // we do not have the concept of policy
    vulnerabilities: [],
    dependencyCount: 0,
    licensesPolicy: null, // we do not have the concept of license policies
    ignoreSettings: null,
    targetFile: scanResult.filePath,
    projectName: path.basename(path.dirname(targetFilePath)),
    org: meta.org,
    policy: '', // we do not have the concept of policy
    isPrivate: true,
    targetFilePath,
    packageManager: engineTypeToProjectType[scanResult.engineType],
  };
}

function groupMultiDocResults(
  scanResults: IacFileScanResult[],
): IacFileScanResult[] {
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

  return Object.values(groupedData);
}

export function filterPoliciesBySeverity(
  violatedPolicies: PolicyMetadata[],
  severityThreshold?: SEVERITY,
): PolicyMetadata[] {
  if (!severityThreshold || severityThreshold === SEVERITY.LOW) {
    return violatedPolicies.filter((violatedPolicy) => {
      return violatedPolicy.severity !== 'none';
    });
  }

  const severitiesToInclude = SEVERITIES.slice(
    SEVERITIES.indexOf(severityThreshold),
  );
  return violatedPolicies.filter((policy) => {
    return (
      policy.severity !== 'none' &&
      severitiesToInclude.includes(policy.severity)
    );
  });
}

export class FailedToFormatResults extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to format results');
    this.code = IaCErrorCodes.FailedToFormatResults;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      'We failed printing the results, please contact support@snyk.io';
  }
}
