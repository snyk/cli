import {
  EngineType,
  FormattedResult,
  IaCErrorCodes,
  IacFileScanResult,
  IaCTestFlags,
  PolicyMetadata,
} from './types';
import { SEVERITY } from '../../../../lib/snyk-test/common';
import { IacProjectType } from '../../../../lib/iac/constants';
import { CustomError } from '../../../../lib/errors';
import {
  issuesToLineNumbers,
  CloudConfigFileTypes,
} from '@snyk/cloud-config-parser';
import { UnsupportedFileTypeError } from './file-parser';
import * as analytics from '../../../../lib/analytics';
import * as Debug from 'debug';

const debug = Debug('iac-results-formatter');
const SEVERITIES = [SEVERITY.LOW, SEVERITY.MEDIUM, SEVERITY.HIGH];

export function formatScanResults(
  scanResults: IacFileScanResult[],
  options: IaCTestFlags,
): FormattedResult[] {
  try {
    // Relevant only for multi-doc yaml files
    const scannedResultsGroupedByDocId = groupMultiDocResults(scanResults);
    return scannedResultsGroupedByDocId.map((iacScanResult) =>
      formatScanResult(iacScanResult, options.severityThreshold),
    );
  } catch (e) {
    throw new FailedToFormatResults();
  }
}

function getFileTypeForLineNumber(fileType: string): CloudConfigFileTypes {
  switch (fileType) {
    case 'yaml':
    case 'yml':
      return CloudConfigFileTypes.YAML;
    case 'json':
      return CloudConfigFileTypes.JSON;
    case 'tf':
      return CloudConfigFileTypes.TF;
    default:
      throw new UnsupportedFileTypeError(fileType);
  }
}

const engineTypeToProjectType = {
  [EngineType.Kubernetes]: IacProjectType.K8S,
  [EngineType.Terraform]: IacProjectType.TERRAFORM,
};

function formatScanResult(
  scanResult: IacFileScanResult,
  severityThreshold?: SEVERITY,
): FormattedResult {
  const formattedIssues = scanResult.violatedPolicies.map((policy) => {
    const cloudConfigPath =
      scanResult.docId !== undefined
        ? [`[DocId:${scanResult.docId}]`].concat(policy.msg.split('.'))
        : policy.msg.split('.');

    let lineNumber: number;
    try {
      lineNumber = issuesToLineNumbers(
        scanResult.fileContent,
        getFileTypeForLineNumber(scanResult.fileType),
        policy.msg.split('.'), // parser defaults to docId:0 and checks for the rest of the path
      );
    } catch {
      const err = new FailedToExtractLineNumberError();
      analytics.add('error-code', err.code);
      debug('Parser library failed. Could not assign lineNumber to issue');
      lineNumber = -1;
    }

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
    };
  });
  return {
    result: {
      cloudConfigResults: filterPoliciesBySeverity(
        formattedIssues,
        severityThreshold,
      ),
    },
    isPrivate: true,
    packageManager: engineTypeToProjectType[scanResult.engineType],
    targetFile: scanResult.filePath,
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

function filterPoliciesBySeverity(
  violatedPolicies: PolicyMetadata[],
  severityThreshold?: SEVERITY,
): PolicyMetadata[] {
  if (!severityThreshold || severityThreshold === SEVERITY.LOW) {
    return violatedPolicies;
  }

  const severitiesToInclude = SEVERITIES.slice(
    SEVERITIES.indexOf(severityThreshold),
  );

  return violatedPolicies.filter((policy) =>
    severitiesToInclude.includes(policy.severity),
  );
}

export class FailedToFormatResults extends CustomError {
  constructor(message?: string) {
    super(message || 'Failed to format results');
    this.code = IaCErrorCodes.FailedToFormatResults;
    this.userMessage =
      'We failed printing the results, please contact support@snyk.io';
  }
}

class FailedToExtractLineNumberError extends CustomError {
  constructor(message?: string) {
    super(
      message || 'Parser library failed. Could not assign lineNumber to issue',
    );
    this.code = IaCErrorCodes.FailedToExtractLineNumberError;
    this.userMessage = ''; // Not a user facing error.
  }
}
