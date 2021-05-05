import * as fs from 'fs';
import * as path from 'path';
import * as pathLib from 'path';
import * as pathUtil from 'path';
import * as snyk from '..';
import * as config from '../config';
import { IacFileTypes, projectTypeByFileType } from '../iac/constants';
import { isCI } from '../is-ci';
import { Options, TestOptions } from '../types';
import * as common from './common';
import { IacTestResponse } from './iac-test-result';
import { SEVERITY, TestResult } from './legacy';
import { IacScan } from './payload-schema';
import { Payload } from './types';

export async function parseIacTestResult(
  res: IacTestResponse,
  targetFile: string | undefined,
  targetFileRelativePath: string | undefined,
  projectName: any,
  severityThreshold?: SEVERITY,
  //TODO(orka): future - return a proper type
): Promise<TestResult> {
  const meta = (res as any).meta || {};

  severityThreshold =
    severityThreshold === SEVERITY.LOW ? undefined : severityThreshold;

  return {
    ...res,
    vulnerabilities: [],
    dependencyCount: 0,
    licensesPolicy: null,
    ignoreSettings: null,
    targetFile,
    projectName,
    org: meta.org,
    policy: meta.policy,
    isPrivate: !meta.isPublic,
    severityThreshold,
    targetFilePath: targetFileRelativePath,
  };
}

export interface IacPayloadFileDetails {
  fileType: string;
  fileName: string;
  filePath: string;
  targetFileRelativePath: string;
}

export async function assembleIacLocalPayloads(
  root: string,
  options: Options & TestOptions,
): Promise<Payload[]> {
  const filesToTest: IacPayloadFileDetails[] = [];

  if (!options.iacDirFiles) {
    const fileType = pathLib.extname(root).substr(1);
    const targetFile = pathLib.resolve(root, '.');
    const targetFileRelativePath = targetFile
      ? pathUtil.join(pathUtil.resolve(`${options.path}`), targetFile)
      : '';
    filesToTest.push({
      fileType,
      fileName: root,
      filePath: targetFile,
      targetFileRelativePath,
    });
  } else {
    for (const iacFile of options.iacDirFiles) {
      if (iacFile.projectType) {
        const targetFile = iacFile.filePath;
        filesToTest.push({
          fileType: iacFile.fileType,
          fileName: path.basename(targetFile),
          filePath: targetFile,
          targetFileRelativePath: targetFile,
        });
      }
    }
  }

  return filesToTest.map((iacFileDetails) => {
    return assembleIacLocalPayload(iacFileDetails, options);
  });
}

function assembleIacLocalPayload(
  fileDetails: IacPayloadFileDetails,
  options: Options & TestOptions,
): Payload {
  const fileContent = fs.readFileSync(fileDetails.filePath, 'utf8');
  const projectType = projectTypeByFileType[fileDetails.fileType];

  const body: IacScan = {
    data: {
      fileContent,
      fileType: fileDetails.fileType as IacFileTypes,
    },
    targetFile: fileDetails.fileName,
    type: projectType,
    //TODO(orka): future - support policy
    policy: '',
    targetFileRelativePath: `${fileDetails.targetFileRelativePath}`, // Forcing string
    originalProjectName: path.basename(path.dirname(fileDetails.filePath)),
    projectNameOverride: options.projectName,
  };
  const payload: Payload = {
    method: 'POST',
    url: config.API + (options.vulnEndpoint || '/test-iac'),
    json: true,
    headers: {
      'x-is-ci': isCI(),
      authorization: 'token ' + (snyk as any).api,
    },
    qs: common.assembleQueryString(options),
    body,
  };

  return payload;
}
