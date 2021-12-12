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

interface VarsValues {
  inputs: StringRecord;
  locals: StringRecord;
}

const INPUTS_REF_REGEX = /^\${var\..*}$/;

const LOCALS_REF_REGEX = /^\${local\..*}$/;

function getDefaultValues(
  tfFiles: IacVarsFileData[],
  varsValues: StringRecord,
): StringRecord {
  tfFiles.forEach((tfFile) => {
    const parsedVarsFile = hclToJson(tfFile.fileContent);
    if (parsedVarsFile.variable) {
      const fileVars = parsedVarsFile.variable as StringRecord<StringRecord>;
      Object.entries(fileVars).forEach(([key, val]) => {
        varsValues[key] = val.default;
      });
    }
  });

  return varsValues;
}

function getLocalValues(
  tfFiles: IacVarsFileData[],
  localsValues: StringRecord,
): StringRecord {
  tfFiles.forEach((tfFile) => {
    const parsedLoacalsFile = hclToJson(tfFile.fileContent);
    if (parsedLoacalsFile.locals) {
      const fileLocals = parsedLoacalsFile.locals as StringRecord<StringRecord>;
      Object.entries(fileLocals).forEach(([key, val]) => {
        localsValues[key] = val;
      });
    }
  });

  return localsValues;
}

function getInputValues(
  tfVarsFiles: IacVarsFileData[],
  varsValues: StringRecord,
): StringRecord {
  tfVarsFiles.forEach((tfVarsFile) => {
    const parsedVarsFile = hclToJson(tfVarsFile.fileContent);

    if (parsedVarsFile) {
      const fileVars = parsedVarsFile as StringRecord;
      Object.entries(fileVars).forEach(([key, val]) => {
        varsValues[key] = val;
      });
    }
  });

  return varsValues;
}

function buildInputsValues(
  varsFilesByExt: IacVarsFilesDataByExtension,
): StringRecord {
  const inputsValues: StringRecord = {};
  if (varsFilesByExt.tf) {
    getDefaultValues(varsFilesByExt.tf, inputsValues);
  }

  if (varsFilesByExt.tfvars) {
    getInputValues(varsFilesByExt.tfvars, inputsValues);
  }

  return inputsValues;
}

function buildLocalsValues(
  varsFilesByExt: IacVarsFilesDataByExtension,
): StringRecord {
  const localsValues: StringRecord = {};
  if (varsFilesByExt.tf) {
    getLocalValues(varsFilesByExt.tf, localsValues);
  }

  return localsValues;
}

function buildVarsValuesMap(
  varsFilesByExt: IacVarsFilesDataByExtension,
): VarsValues {
  return {
    inputs: buildInputsValues(varsFilesByExt),
    locals: buildLocalsValues(varsFilesByExt),
  };
}

function injectValues<T>(jsonFileValue: T, varsValues: VarsValues): T {
  if (typeof jsonFileValue === 'string') {
    if (INPUTS_REF_REGEX.test(jsonFileValue)) {
      const inputName: string = (jsonFileValue as string).slice(6, -1);
      if (varsValues.inputs[inputName]) {
        return varsValues.inputs[inputName] as T;
      }
    } else if (LOCALS_REF_REGEX.test(jsonFileValue)) {
      const localName: string = (jsonFileValue as string).slice(8, -1);
      if (varsValues.locals[localName]) {
        return varsValues.locals[localName] as T;
      }
    }
  } else if (Array.isArray(jsonFileValue)) {
    jsonFileValue.forEach((el, i) => {
      jsonFileValue[i] = injectValues(el, varsValues);
    });
  } else if (typeof jsonFileValue === 'object') {
    Object.entries(jsonFileValue as StringRecord).forEach(([key, val]) => {
      jsonFileValue[key] = injectValues(val, varsValues);
    });
  }
  return jsonFileValue;
}

function dereferenceTFVars(
  jsonFileContent: StringRecord,
  varsFilesByExt: IacVarsFilesDataByExtension,
) {
  const values = buildVarsValuesMap(varsFilesByExt);
  return injectValues(jsonFileContent, values);
}

export function tryParsingTerraformFile(
  fileData: IacFileData,
): Array<IacFileParsed> {
  try {
    let jsonContent = hclToJson(fileData.fileContent);

    if (fileData.varsFilesByExt) {
      jsonContent = dereferenceTFVars(jsonContent, fileData.varsFilesByExt);
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
