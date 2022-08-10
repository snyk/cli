import { getErrorStringCode } from '../../../../cli/commands/test/iac/local-execution/error-utils';
import { IaCErrorCodes } from '../../../../cli/commands/test/iac/local-execution/types';
import { CustomError } from '../../../errors';
import { ScanError } from './scan/results';

const defaultUserMessage =
  'Your test request could not be completed. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output';

const snykIacTestErrorsUserMessages = {
  NoPaths: 'No valid paths were provided',
  CwdTraversal:
    'Running the scan from outside of the current working directory is not supported',
  NoBundle: 'A rules bundle were not provided',
  OpenBundle: "The Snyk CLI couldn't open the rules bundle",
  InvalidSeverityThreshold:
    'The provided severity threshold is invalid. The following values are supported: "low", "medium", "high", "critical"',
  Scan: defaultUserMessage,
  UnableToRecognizeInputType: 'Input type was not recognized',
  UnsupportedInputType: 'Input type is not supported',
  UnableToResolveLocation: 'Could not resolve location of resource/attribute',
  UnrecognizedFileExtension: 'Unrecognized file extension',
  FailedToParseInput: 'Failed to parse input',
  InvalidInput: 'Invalid input',
  UnableToReadFile: 'Unable to read file',
  UnableToReadDir: 'Unable to read directory',
  UnableToReadStdin: 'Unable to read stdin',
  FailedToLoadRegoAPI: defaultUserMessage,
  FailedToLoadRules: defaultUserMessage,
  FailedToCompile: defaultUserMessage,
  UnableToReadPath: 'Unable to read path',
  NoLoadableInput:
    "The Snyk CLI couldn't find any valid IaC configuration files to scan",
  FailedToShareResults: 'Failed to upload the test results with the platform',
};

export function getErrorUserMessage(code: number): string {
  if (code < 2000 || code >= 3000) {
    return 'INVALID_SNYK_IAC_TEST_ERROR';
  }
  const errorName = IaCErrorCodes[code];
  if (!errorName) {
    return 'INVALID_IAC_ERROR';
  }
  return snykIacTestErrorsUserMessages[errorName];
}

export class SnykIacTestError extends CustomError {
  public fields: { path: string; [key: string]: string };

  constructor(scanError: ScanError) {
    super(scanError.message);
    this.code = scanError.code;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = getErrorUserMessage(this.code);
    this.fields = Object.assign(
      {
        path: '',
      },
      scanError.fields,
    );
  }

  public get path(): string {
    return this.fields?.path;
  }

  public set path(path1: string) {
    this.fields.path = path1;
  }
}
