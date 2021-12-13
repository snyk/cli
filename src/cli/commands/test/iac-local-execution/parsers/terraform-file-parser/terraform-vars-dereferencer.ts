import { IacVarsFileData, IacVarsFilesDataByExtension } from '../../types';
import hclToJson from '../hcl-to-json';
import { InvalidHclSyntaxError } from './terraform-file-parser';

type StringRecord<T = unknown> = Record<string, T>;

interface VarsValues {
  inputs: StringRecord;
  locals: StringRecord;
}

const VARS_REF_REGEX = /^\${var\..*}$/;
const TF_ENV_VAR_REGEX = /^TF_VAR_.*/;
const LOCALS_REF_REGEX = /^\${local\..*}$/;

function fillDefaultsValues(
  tfFiles: IacVarsFileData[],
  varsValues: VarsValues,
): void {
  tfFiles.forEach((tfFile) => {
    const parsedVarsFile = hclToJson(tfFile.fileContent);
    if (parsedVarsFile.variable) {
      const fileVars = parsedVarsFile.variable as StringRecord<StringRecord>;

      Object.entries(fileVars).forEach(([key, val]) => {
        if (Array.isArray(val)) {
          throw new InvalidHclSyntaxError(
            tfFile.filePath,
            `Invalid HCL syntax: Variable "${key}" was declared multiple times.`,
          );
        }
        varsValues.inputs[key] = val.default;
      });
    }
  });
}

function getLocalsValues(
  tfFiles: IacVarsFileData[],
  varsValues: VarsValues,
): void {
  tfFiles.forEach((tfFile) => {
    const parsedLoacalsFile = hclToJson(tfFile.fileContent);
    if (parsedLoacalsFile.locals) {
      const fileLocals = parsedLoacalsFile.locals as StringRecord<StringRecord>;
      Object.entries(fileLocals).forEach(([key, val]) => {
        varsValues.locals[key] =
          typeof val === 'string'
            ? (varsValues.locals[key] = getVarValueFromStringExp(
                val,
                varsValues,
              ))
            : val;
      });
    }
  });
}

function getInputsValues(
  tfVarsFiles: IacVarsFileData[],
  varsValues: VarsValues,
): void {
  tfVarsFiles.forEach((tfVarsFile) => {
    const parsedVarsFile = hclToJson(tfVarsFile.fileContent);

    if (parsedVarsFile) {
      const fileVars = parsedVarsFile as StringRecord;
      Object.entries(fileVars).forEach(([key, val]) => {
        varsValues.inputs[key] = val;
      });
    }
  });
}

function fillEnvVarsValues(varsValues: VarsValues) {
  Object.keys(process.env).forEach((key) => {
    if (TF_ENV_VAR_REGEX.test(key)) {
      const valueName = key.slice(7);
      varsValues.inputs[valueName] = process.env[key];
    }
  });
}

function fillInputsValuesMap(
  varsFilesByExt: IacVarsFilesDataByExtension,
  varsValues: VarsValues,
): void {
  if (varsFilesByExt.tf) {
    fillDefaultsValues(varsFilesByExt.tf, varsValues);
  }

  fillEnvVarsValues(varsValues);

  if (varsFilesByExt.tfvars) {
    getInputsValues(varsFilesByExt.tfvars, varsValues);
  }
}

function fillLocalsValuesMap(
  varsFilesByExt: IacVarsFilesDataByExtension,
  varsValues: VarsValues,
): void {
  if (varsFilesByExt.tf) {
    getLocalsValues(varsFilesByExt.tf, varsValues);
  }
}

function buildVarsValuesMap(
  varsFilesByExt: IacVarsFilesDataByExtension,
): VarsValues {
  const varsValues = {
    inputs: {},
    locals: {},
  };

  fillInputsValuesMap(varsFilesByExt, varsValues);
  fillLocalsValuesMap(varsFilesByExt, varsValues);

  return varsValues;
}

function getVarValueFromStringExp(exp: string, varsValues: VarsValues) {
  if (VARS_REF_REGEX.test(exp)) {
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

export function dereferenceVars(
  jsonFileContent: StringRecord,
  varsFilesByExt: IacVarsFilesDataByExtension,
): StringRecord {
  const varsValues = buildVarsValuesMap(varsFilesByExt);
  return injectVarsValues(jsonFileContent, varsValues) as StringRecord;
}
