import { detectConfigType } from './parsers/k8s-or-cloudformation-parser';
import { tryParsingTerraformFile } from './parsers/terraform-file-parser';
import { NoFilesToScanError } from './file-loader';
import {
  isTerraformPlan,
  tryParsingTerraformPlan,
} from './parsers/terraform-plan-parser';

import {
  IaCErrorCodes,
  IacFileData,
  IacFileParsed,
  IacFileParseFailure,
  IaCTestFlags,
  ParsingResults,
  TerraformPlanScanMode,
} from './types';
import * as analytics from '../../../../lib/analytics';
import { CustomError } from '../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import { parseYAMLOrJSONFileData } from './yaml-parser';

export async function parseFiles(
  filesData: IacFileData[],
  options: IaCTestFlags = {},
): Promise<ParsingResults> {
  const parsedFiles: IacFileParsed[] = [];
  const failedFiles: IacFileParseFailure[] = [];
  for (const fileData of filesData) {
    try {
      parsedFiles.push(...tryParseIacFile(fileData, options));
    } catch (err) {
      if (filesData.length === 1) {
        throw err;
      }
      failedFiles.push(generateFailedParsedFile(fileData, err));
    }
  }

  if (parsedFiles.length === 0) {
    throw new NoFilesToScanError();
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

function tryParseIacFile(
  fileData: IacFileData,
  options: IaCTestFlags = {},
): IacFileParsed[] {
  analytics.add('iac-terraform-plan', false);
  switch (fileData.fileType) {
    case 'yaml':
    case 'yml': {
      const parsedIacFile = parseYAMLOrJSONFileData(fileData);
      return detectConfigType(fileData, parsedIacFile);
    }
    case 'json': {
      const parsedIacFile = parseYAMLOrJSONFileData(fileData);
      // the Kubernetes file can have more than one JSON object in it
      // but the Terraform plan can only have one
      if (parsedIacFile.length === 1 && isTerraformPlan(parsedIacFile[0])) {
        analytics.add('iac-terraform-plan', true);
        return tryParsingTerraformPlan(fileData, parsedIacFile[0], {
          isFullScan: options.scan === TerraformPlanScanMode.FullScan,
        });
      } else {
        return detectConfigType(fileData, parsedIacFile);
      }
    }
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
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `Unable to process the file with extension ${fileType}. Supported file extensions are tf, yml, yaml & json.\nMore information can be found by running \`snyk iac test --help\` or through our documentation:\nhttps://support.snyk.io/hc/en-us/articles/360012429477-Test-your-Kubernetes-files-with-our-CLI-tool\nhttps://support.snyk.io/hc/en-us/articles/360013723877-Test-your-Terraform-files-with-our-CLI-tool`;
  }
}
