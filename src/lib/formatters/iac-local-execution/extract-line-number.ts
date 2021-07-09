import {
  IaCErrorCodes,
  IacFileScanResult,
  PolicyMetadata,
} from '../../../cli/commands/test/iac-local-execution/types';
import { CustomError } from '../../errors';
import {
  CloudConfigFileTypes,
  issuesToLineNumbers,
} from '@snyk/cloud-config-parser';
import { UnsupportedFileTypeError } from '../../../cli/commands/test/iac-local-execution/file-parser';
import * as analytics from '../../analytics';
import * as Debug from 'debug';
import { getErrorStringCode } from '../../../cli/commands/test/iac-local-execution/error-utils';
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
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = ''; // Not a user facing error.
  }
}
