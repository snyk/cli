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
import { isLocalFolder } from '../../../../lib/detect';

const SEVERITIES = [SEVERITY.LOW, SEVERITY.MEDIUM, SEVERITY.HIGH];

export function formatScanResults(
  scanResults: IacFileScanResult[],
  options: IaCTestFlags,
  meta: TestMeta,
): FormattedResult[] {
  try {
    const groupedByFile = scanResults.reduce((memo, scanResult) => {
      const res = formatScanResult(scanResult, meta, options);
      if (memo[scanResult.filePath]) {
        memo[scanResult.filePath].result.cloudConfigResults.push(
          ...res.result.cloudConfigResults,
        );
      } else {
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
  [EngineType.Custom]: IacProjectType.CUSTOM,
};

function formatScanResult(
  scanResult: IacFileScanResult,
  meta: TestMeta,
  options: IaCTestFlags,
): FormattedResult {
  const formattedIssues = scanResult.violatedPolicies.map((policy) => {
    const cloudConfigPath =
      scanResult.docId !== undefined
        ? [`[DocId: ${scanResult.docId}]`].concat(policy.msg.split('.'))
        : policy.msg.split('.');

    const flagsRequiringLineNumber = [
      'json',
      'sarif',
      'json-file-output',
      'sarif-file-output',
    ];
    const shouldExtractLineNumber = flagsRequiringLineNumber.some(
      (flag) => options[flag],
    );
    const lineNumber: number = shouldExtractLineNumber
      ? extractLineNumber(
          scanResult.fileContent,
          scanResult.fileType,
          cloudConfigPath,
        )
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

function computePaths(
  filePath: string,
  pathArg = '.',
): { targetFilePath: string; projectName: string; targetFile: string } {
  const targetFilePath = path.resolve(filePath, '.');

  // the absolute path is needed to compute the full project path
  const cmdPath = path.resolve(pathArg);

  let projectPath: string;
  let targetFile: string;
  if (!isLocalFolder(cmdPath)) {
    // if the provided path points to a file, then the project starts at the parent folder of that file
    // and the target file was provided as the path argument
    projectPath = path.dirname(cmdPath);
    targetFile = path.isAbsolute(pathArg)
      ? path.relative(process.cwd(), pathArg)
      : pathArg;
  } else {
    // otherwise, the project starts at the provided path
    // and the target file must be the relative path from the project path to the path of the scanned file
    projectPath = cmdPath;
    targetFile = path.relative(projectPath, targetFilePath);
  }

  return {
    targetFilePath,
    projectName: path.basename(projectPath),
    targetFile,
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
