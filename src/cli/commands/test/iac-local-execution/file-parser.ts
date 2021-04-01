import { tryParsingKubernetesFile } from './parsers/kubernetes-parser';
import { tryParsingTerraformFile } from './parsers/terraform-file-parser';
import { tryParsingTerraformPlan } from './parsers/terraform-plan-parser';

import * as path from 'path';
import {
  IacFileParsed,
  IacFileData,
  ParsingResults,
  IacFileParseFailure,
  IaCErrorCodes,
} from './types';
import * as analytics from '../../../../lib/analytics';
import { CustomError } from '../../../../lib/errors';

export async function parseFiles(
  filesData: IacFileData[],
): Promise<ParsingResults> {
  const parsedFiles: Array<IacFileParsed> = [];
  const failedFiles: Array<IacFileParseFailure> = [];
  for (const fileData of filesData) {
    try {
      parsedFiles.push(...tryParseIacFile(fileData));
    } catch (err) {
      if (filesData.length === 1) {
        throw err;
      }
      failedFiles.push(generateFailedParsedFile(fileData, err));
    }
  }

  return {
    parsedFiles,
    failedFiles,
  };
}

function generateFailedParsedFile(
  { fileType, filePath, fileContent }: IacFileData,
  err: Error,
) {
  return {
    err,
    failureReason: err.message,
    fileType,
    filePath,
    fileContent,
    engineType: null,
    jsonContent: null,
  };
}

const TF_PLAN_NAME = 'tf-plan.json';

export function tryParseIacFile(fileData: IacFileData): Array<IacFileParsed> {
  analytics.add('iac-terraform-plan', false);
  switch (fileData.fileType) {
    case 'yaml':
    case 'yml':
    case 'json':
      // TODO: this is a temporary approach for the internal release only
      if (path.basename(fileData.filePath) === TF_PLAN_NAME) {
        analytics.add('iac-terraform-plan', true);
        return tryParsingTerraformPlan(fileData);
      }

      return tryParsingKubernetesFile(fileData);
    case 'tf':
      return tryParsingTerraformFile(fileData);
    default:
      throw new UnsupportedFileTypeError(fileData.fileType);
  }
}

export class UnsupportedFileTypeError extends CustomError {
  constructor(fileType: string) {
    super('Unsupported file extension');
    this.code = IaCErrorCodes.UnsupportedFileTypeError;
    this.userMessage = `Unable to process the file with extension ${fileType}. Supported file extensions are tf, yml, yaml & json.\nMore information can be found by running \`snyk iac test --help\` or through our documentation:\nhttps://support.snyk.io/hc/en-us/articles/360012429477-Test-your-Kubernetes-files-with-our-CLI-tool\nhttps://support.snyk.io/hc/en-us/articles/360013723877-Test-your-Terraform-files-with-our-CLI-tool`;
  }
}
