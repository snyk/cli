import hclToJson from '../hcl-to-json';
import {
  EngineType,
  IaCErrorCodes,
  IacFileData,
  IacFileParsed,
} from '../../types';
import { CustomError } from '../../../../../../lib/errors';
import { getErrorStringCode } from '../../error-utils';
import { IacProjectType } from '../../../../../../lib/iac/constants';
import { dereferenceVars } from './terraform-vars-dereferencer';

export function tryParsingTerraformFile(
  fileData: IacFileData,
): Array<IacFileParsed> {
  try {
    let jsonContent = hclToJson(fileData.fileContent);

    if (fileData.varsFilesByExt) {
      jsonContent = dereferenceVars(jsonContent, fileData.varsFilesByExt);
    }

    return [
      {
        ...fileData,
        jsonContent,
        projectType: IacProjectType.TERRAFORM,
        engineType: EngineType.Terraform,
      },
    ];
  } catch (err) {
    throw new FailedToParseTerraformFileError(fileData.filePath);
  }
}

export class FailedToParseTerraformFileError extends CustomError {
  constructor(filename: string) {
    super('Failed to parse Terraform file');
    this.code = IaCErrorCodes.FailedToParseTerraformFileError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to parse the Terraform file "${filename}", please ensure it is valid HCL2. This can be done by running it through the 'terraform validate' command.`;
  }
}

export class InvalidHclSyntaxError extends CustomError {
  constructor(filePath: string, message?: string) {
    super('Invalid HCL syntax');
    this.code = IaCErrorCodes.InvalidHclSyntax;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      `The following file had invalid HCL syntax: ${filePath}` + message
        ? `\n${message}`
        : '';
  }
}
