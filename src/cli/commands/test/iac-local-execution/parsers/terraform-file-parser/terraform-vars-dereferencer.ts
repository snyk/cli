import { IacVarsFileData, IacVarsFilesDataByExtension } from '../../types';
import hclToJson from '../hcl-to-json';

type StringRecord<T = unknown> = Record<string, T>;

interface VarsValues {
  inputs: StringRecord;
  locals: StringRecord;
}

const INPUTS_REF_REGEX = /^\${var\..*}$/;
const ENV_VAR_REF_REGEX = /^TF_VAR_.*/;
const LOCALS_REF_REGEX = /^\${local\..*}$/;

function getDefaultsValues(
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

function getLocalsValues(
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

function getInputsValues(
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

function buildInputsValuesMap(
  varsFilesByExt: IacVarsFilesDataByExtension,
): StringRecord {
  const inputsValues: StringRecord = {};
  if (varsFilesByExt.tf) {
    getDefaultsValues(varsFilesByExt.tf, inputsValues);
  }

  Object.keys(process.env).forEach((key) => {
    if (ENV_VAR_REF_REGEX.test(key)) {
      const valueName = key.slice(7);
      inputsValues[valueName] = process.env[key];
    }
  });

  if (varsFilesByExt.tfvars) {
    getInputsValues(varsFilesByExt.tfvars, inputsValues);
  }

  return inputsValues;
}

function buildLocalsValuesMap(
  varsFilesByExt: IacVarsFilesDataByExtension,
): StringRecord {
  const localsValues: StringRecord = {};
  if (varsFilesByExt.tf) {
    getLocalsValues(varsFilesByExt.tf, localsValues);
  }

  return localsValues;
}

function buildVarsValuesMap(
  varsFilesByExt: IacVarsFilesDataByExtension,
): VarsValues {
  return {
    inputs: buildInputsValuesMap(varsFilesByExt),
    locals: buildLocalsValuesMap(varsFilesByExt),
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

export function dereferenceVars(
  jsonFileContent: StringRecord,
  varsFilesByExt: IacVarsFilesDataByExtension,
): StringRecord {
  const varsValues = buildVarsValuesMap(varsFilesByExt);
  return injectVarsValues(jsonFileContent, varsValues) as StringRecord;
}
