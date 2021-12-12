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
const ENV_VAR_REF_REGEX = /^TF_VAR_.*/;
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

  Object.keys(process.env).forEach((key) => {
    if (ENV_VAR_REF_REGEX.test(key)) {
      const valueName = key.slice(7);
      inputsValues[valueName] = process.env[key];
    }
  });

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

function getVarValueFromStringExp(exp: string, varsValues: VarsValues) {
  if (INPUTS_REF_REGEX.test(exp)) {
    const inputName: string = exp.slice(6, -1);
    if (varsValues.inputs[inputName]) {
      return varsValues.inputs[inputName];
    }
  } else if (LOCALS_REF_REGEX.test(exp)) {
    const localName: string = (exp as string).slice(8, -1);
    if (varsValues.locals[localName]) {
      return varsValues.locals[localName];
    }
  }

  return exp;
}

function injectVarsValues(
  subFileJsonExpr: unknown,
  varsValues: VarsValues,
): unknown {
  if (typeof subFileJsonExpr === 'string') {
    subFileJsonExpr = getVarValueFromStringExp(subFileJsonExpr, varsValues);
  } else if (Array.isArray(subFileJsonExpr)) {
    subFileJsonExpr.forEach((el, i) => {
      (subFileJsonExpr as unknown[])[i] = injectVarsValues(el, varsValues);
    });
  } else if (typeof subFileJsonExpr === 'object') {
    Object.entries(subFileJsonExpr as StringRecord).forEach(([key, val]) => {
      (subFileJsonExpr as StringRecord)[key] = injectVarsValues(
        val,
        varsValues,
      );
    });
  }

  return subFileJsonExpr;
}

function dereferenceVars(
  jsonFileContent: StringRecord,
  varsFilesByExt: IacVarsFilesDataByExtension,
): StringRecord {
  const varsValues = buildVarsValuesMap(varsFilesByExt);
  return injectVarsValues(jsonFileContent, varsValues) as StringRecord;
}

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
