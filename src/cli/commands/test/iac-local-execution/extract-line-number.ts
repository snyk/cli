import { IaCErrorCodes } from './types';
import { CustomError } from '../../../../lib/errors';
import {
  CloudConfigFileTypes,
  issuesToLineNumbers,
} from '@snyk/cloud-config-parser';
import { UnsupportedFileTypeError } from './file-parser';
import * as analytics from '../../../../lib/analytics';
import * as Debug from 'debug';
import { getErrorStringCode } from './error-utils';
const debug = Debug('iac-extract-line-number');

function getFileTypeForLineNumber(fileType: string): CloudConfigFileTypes {
  switch (fileType) {
    case 'yaml':
    case 'yml':
      return CloudConfigFileTypes.YAML;
    case 'json':
      return CloudConfigFileTypes.JSON;
    case 'tf':
      return CloudConfigFileTypes.TF;
    default:
      throw new UnsupportedFileTypeError(fileType);
  }
}

export function extractLineNumber(
  fileContent: string,
  fileType: string,
  cloudConfigPath: string[],
): number {
  try {
    return issuesToLineNumbers(
      fileContent,
      getFileTypeForLineNumber(fileType),
      cloudConfigPath,
    );
  } catch {
    const err = new FailedToExtractLineNumberError();
    analytics.add('error-code', err.code);
    debug('Parser library failed. Could not assign lineNumber to issue');
    return -1;
  }
}

class FailedToExtractLineNumberError extends CustomError {
  constructor(message?: string) {
    super(
      message || 'Parser library failed. Could not assign lineNumber to issue',
    );
    this.code = IaCErrorCodes.FailedToExtractLineNumberError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = ''; // Not a user facing error.
  }
}
