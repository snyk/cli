import { IaCErrorCodes, IacFileScanResult, PolicyMetadata } from './types';
import { CustomError } from '../../../../lib/errors';
import {
  CloudConfigFileTypes,
  issuesToLineNumbers,
} from '@snyk/cloud-config-parser';
import { UnsupportedFileTypeError } from './file-parser';
import * as analytics from '../../../../lib/analytics';
const util = require('util');
const debug = util.debuglog('iac-extract-line-number');

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
  scanResult: IacFileScanResult,
  policy: PolicyMetadata,
): number {
  try {
    return issuesToLineNumbers(
      scanResult.fileContent,
      getFileTypeForLineNumber(scanResult.fileType),
      policy.msg.split('.'), // parser defaults to docId:0 and checks for the rest of the path
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
    this.userMessage = ''; // Not a user facing error.
  }
}
