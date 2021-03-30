import * as hclToJson from 'hcl-to-json';
import {
  EngineType,
  IaCErrorCodes,
  IacFileData,
  IacFileParsed,
} from '../types';
import { CustomError } from '../../../../../lib/errors';

export function tryParsingTerraformFile(
  fileData: IacFileData,
): Array<IacFileParsed> {
  try {
    // TODO: This parser does not fail on inavlid Terraform files! it is here temporarily.
    // cloud-config team will replace it to a valid parser for the beta release.
    const parsedData = hclToJson(fileData.fileContent);
    return [
      {
        ...fileData,
        jsonContent: parsedData,
        engineType: EngineType.Terraform,
      },
    ];
  } catch (err) {
    throw new FailedToParseTerraformFileError(fileData.filePath);
  }
}

class FailedToParseTerraformFileError extends CustomError {
  constructor(filename: string) {
    super('Failed to parse Terraform file');
    this.code = IaCErrorCodes.FailedToParseTerraformFileError;
    this.userMessage = `We were unable to parse the Terraform file "${filename}", please ensure it is valid HCL2. This can be done by running it through the 'terraform validate' command.`;
  }
}
