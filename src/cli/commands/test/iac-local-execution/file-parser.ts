import { tryParsingKubernetesFile } from './parsers/kubernetes-parser';
import { tryParsingTerraformFile } from './parsers/terraform-file-parser';
import { tryParsingTerraformPlan } from './parsers/terraform-plan-parser';
import * as path from 'path';
import {
  IacFileParsed,
  IacFileData,
  ParsingResults,
  IacFileParseFailure,
} from './types';

export async function parseFiles(
  filesData: IacFileData[],
): Promise<ParsingResults> {
  const parsedFiles: Array<IacFileParsed> = [];
  const failedFiles: Array<IacFileParseFailure> = [];
  for (const fileData of filesData) {
    try {
      parsedFiles.push(...tryParseIacFile(fileData));
    } catch (err) {
      if (filesData.length === 1) throw err;
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

function tryParseIacFile(fileData: IacFileData): Array<IacFileParsed> {
  switch (fileData.fileType) {
    case 'yaml':
    case 'yml':
    case 'json':
      // TODO: this is a temporary approach for the internal release only
      if (path.basename(fileData.filePath) === TF_PLAN_NAME) {
        return tryParsingTerraformPlan(fileData);
      }

      return tryParsingKubernetesFile(fileData);
    case 'tf':
      return tryParsingTerraformFile(fileData);
    default:
      throw new Error('Invalid IaC file');
  }
}
