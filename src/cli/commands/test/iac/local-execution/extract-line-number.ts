import { IaCErrorCodes } from './types';
import { CustomError } from '../../../../../lib/errors';
import {
  CloudConfigFileTypes,
  MapsDocIdToTree,
  getLineNumber,
} from '@snyk/cloud-config-parser';
import { UnsupportedFileTypeError } from './file-parser';
import * as analytics from '../../../../../lib/analytics';
import * as Debug from 'debug';
import { getErrorStringCode } from './error-utils';
const debug = Debug('iac-extract-line-number');

export function getFileTypeForParser(fileType: string): CloudConfigFileTypes {
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
  cloudConfigPath: string[],
  fileType: CloudConfigFileTypes,
  treeByDocId: MapsDocIdToTree,
): number {
  try {
    return getLineNumber(cloudConfigPath, fileType, treeByDocId);
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
