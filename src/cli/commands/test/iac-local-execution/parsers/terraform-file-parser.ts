import hclToJson from './hcl-to-json';
import {
  EngineType,
  IaCErrorCodes,
  IacFileData,
  IacFileParsed,
  IacVarsFileData,
  IacVarsFilesDataByExtension,
} from '../types';
import { CustomError } from '../../../../../lib/errors';
import { getErrorStringCode } from '../error-utils';
import { IacProjectType } from '../../../../../lib/iac/constants';

type StringRecord<T = unknown> = Record<string, T>;

function getDefaultValues(
  tfFiles: IacVarsFileData[],
  varsValues: StringRecord,
): StringRecord {
  tfFiles.forEach((tfFile) => {
    const parsedVarsFile = hclToJson(tfFile.varsFileContent);
    if (parsedVarsFile.variable) {
      const fileVars = parsedVarsFile.variable as StringRecord<StringRecord>;
      Object.entries(fileVars).forEach(([key, val]) => {
        varsValues[key] = val.default;
      });
    }
  });

  return varsValues;
}

function getInputValues(
  tfVarsFiles: IacVarsFileData[],
  varsValues: StringRecord,
): StringRecord {
  tfVarsFiles.forEach((tfVarsFile) => {
    const parsedVarsFile = hclToJson(tfVarsFile.varsFileContent);

    if (parsedVarsFile) {
      const fileVars = parsedVarsFile as StringRecord;
      Object.entries(fileVars).forEach(([key, val]) => {
        varsValues[key] = val;
      });
    }
  });

  return varsValues;
}

function buildVarsValues(varsFilesByExt: IacVarsFilesDataByExtension) {
  const varsValues: StringRecord = {};
  if (varsFilesByExt.tf) {
    getDefaultValues(varsFilesByExt.tf, varsValues);
  }

  if (varsFilesByExt.tfvars) {
    getInputValues(varsFilesByExt.tfvars, varsValues);
  }

  return varsValues;
}

function dereferenceTFVars(
  jsonFileContent: StringRecord,
  varsFilesByExt: IacVarsFilesDataByExtension,
) {
  const varsValues = buildVarsValues(varsFilesByExt);
}

export function tryParsingTerraformFile(
  fileData: IacFileData,
): Array<IacFileParsed> {
  try {
    if (fileData.varsFilesByExt) {
      dereferenceTFVars(
        hclToJson(fileData.fileContent),
        fileData.varsFilesByExt,
      );
    }

    return [
      {
        ...fileData,
        jsonContent: hclToJson(fileData.fileContent),
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
