import {
  EngineType,
  FormattedResult,
  IaCErrorCodes,
  IacFileScanResult,
  IaCTestFlags,
  PolicyMetadata,
  TestMeta,
} from './types';
import { SEVERITY, SEVERITIES } from '../../../../lib/snyk-test/common';
import { IacProjectType } from '../../../../lib/iac/constants';
import { CustomError } from '../../../../lib/errors';
import { extractLineNumber, getFileTypeForParser } from './extract-line-number';
import { getErrorStringCode } from './error-utils';
import {
  MapsDocIdToTree,
  getTrees,
  parsePath,
} from '@snyk/cloud-config-parser';
import { computePaths } from './file-utils';

const severitiesArray = SEVERITIES.map((s) => s.verboseName);

export function formatScanResults(
  scanResults: IacFileScanResult[],
  options: IaCTestFlags,
  meta: TestMeta,
  projectPublicIds: Record<string, string>,
): FormattedResult[] {
  try {
    const groupedByFile = scanResults.reduce((memo, scanResult) => {
      const res = formatScanResult(scanResult, meta, options);
      if (memo[scanResult.filePath]) {
        memo[scanResult.filePath].result.cloudConfigResults.push(
          ...res.result.cloudConfigResults,
        );
      } else {
        res.meta.projectId = projectPublicIds[res.targetFile];
        memo[scanResult.filePath] = res;
      }
      return memo;
    }, {} as { [key: string]: FormattedResult });
    return Object.values(groupedByFile);
  } catch (e) {
    throw new FailedToFormatResults();
  }
}

const engineTypeToProjectType = {
  [EngineType.Kubernetes]: IacProjectType.K8S,
  [EngineType.Terraform]: IacProjectType.TERRAFORM,
  [EngineType.CloudFormation]: IacProjectType.CLOUDFORMATION,
  [EngineType.ARM]: IacProjectType.ARM,
  [EngineType.Custom]: IacProjectType.CUSTOM,
};

function formatScanResult(
  scanResult: IacFileScanResult,
  meta: TestMeta,
  options: IaCTestFlags,
): FormattedResult {
  const fileType = getFileTypeForParser(scanResult.fileType);
  const isGeneratedByCustomRule = scanResult.engineType === EngineType.Custom;
  let treeByDocId: MapsDocIdToTree;
  try {
    treeByDocId = getTrees(fileType, scanResult.fileContent);
  } catch (err) {
    // we do nothing intentionally.
    // Even if the building of the tree fails in the external parser,
    // we still pass an undefined tree and not calculated line number for those
  }

  const formattedIssues = scanResult.violatedPolicies.map((policy) => {
    const cloudConfigPath =
      scanResult.docId !== undefined
        ? [`[DocId: ${scanResult.docId}]`].concat(parsePath(policy.msg))
        : policy.msg.split('.');

    const lineNumber: number = treeByDocId
      ? extractLineNumber(cloudConfigPath, fileType, treeByDocId)
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
      documentation: !isGeneratedByCustomRule
        ? `https://snyk.io/security-rules/${policy.publicId}`
        : undefined,
      isGeneratedByCustomRule,
    };
  });

  const { targetFilePath, projectName, targetFile } = computePaths(
    scanResult.filePath,
    options.path,
  );
  return {
    result: {
      cloudConfigResults: filterPoliciesBySeverity(
        formattedIssues,
        options.severityThreshold,
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
    targetFile,
    projectName,
    org: meta.org,
    policy: '', // we do not have the concept of policy
    isPrivate: true,
    targetFilePath,
    packageManager: engineTypeToProjectType[scanResult.engineType],
  };
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

  const severitiesToInclude = severitiesArray.slice(
    severitiesArray.indexOf(severityThreshold),
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
