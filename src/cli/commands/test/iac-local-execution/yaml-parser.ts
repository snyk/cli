import * as YAML from 'yaml';
import { CustomError } from '../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import { IaCErrorCodes, IacFileData } from './types';

export function parseYAMLOrJSONFileData(fileData: IacFileData): any[] {
  try {
    return parseYAMLOrJSON(fileData.fileContent);
  } catch (e) {
    if (fileData.fileType === 'json') {
      throw new InvalidJsonFileError(fileData.filePath);
    } else {
      throw new InvalidYamlFileError(fileData.filePath);
    }
  }
}

const errorsToSkip = [
  'Insufficient indentation in flow collection',
  'Map keys must be unique',
];
// the YAML Parser is more strict than the Golang one in Policy Engine,
// so we decided to skip specific errors in order to be consistent.
// this function checks if the current error is one them
function shouldThrowErrorFor(doc: YAML.Document.Parsed) {
  return (
    doc.errors.length !== 0 &&
    !errorsToSkip.some((e) => doc.errors[0].message.includes(e))
  );
}

const warningsToInclude = [
  'Keys with collection values will be stringified as YAML due to JS Object restrictions. Use mapAsMap: true to avoid this.',
];
// The YAML Parser is less strict than the Golang one when it comes to templating directives
// instead it returns them as warnings
// which we now throw on
function shouldThrowWarningFor(doc: YAML.Document.Parsed) {
  return (
    doc.warnings.length !== 0 &&
    warningsToInclude.some((e) => doc.warnings[0].message.includes(e))
  );
}

export function parseYAMLOrJSON(fileContent: string): any[] {
  // the YAML library can parse both YAML and JSON content, as well as content with singe/multiple YAMLs
  // by using this library we don't have to disambiguate between these different contents ourselves
  return YAML.parseAllDocuments(fileContent).map((doc) => {
    if (shouldThrowErrorFor(doc)) {
      throw doc.errors[0];
    }
    if (shouldThrowWarningFor(doc)) {
      throw doc.warnings[0];
    }
    return doc.toJSON();
  });
}

export class InvalidJsonFileError extends CustomError {
  constructor(filename: string) {
    super('Failed to parse JSON file');
    this.code = IaCErrorCodes.InvalidJsonFileError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to parse the JSON file "${filename}". Please ensure that it contains properly structured JSON`;
  }
}

export class InvalidYamlFileError extends CustomError {
  constructor(filename: string) {
    super('Failed to parse YAML file');
    this.code = IaCErrorCodes.InvalidYamlFileError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `We were unable to parse the YAML file "${filename}". Please ensure that it contains properly structured YAML, without any template directives`;
  }
}
