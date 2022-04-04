import { CustomError } from '../../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import { IaCErrorCodes, IacFileData } from './types';
import { ParserFileType, parseFileContent } from '@snyk/cloud-config-parser';

export function parseYAMLOrJSONFileData(fileData: IacFileData): any[] {
  try {
    // this function will always be called with the file types recognised by the parser
    return parseFileContent(
      fileData.fileContent,
      fileData.fileType as ParserFileType,
    );
  } catch (e) {
    if (fileData.fileType === 'json') {
      throw new InvalidJsonFileError(fileData.filePath);
    } else {
      throw new InvalidYamlFileError(fileData.filePath);
    }
  }
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
