import * as fs from 'fs';
import { mapSnykIacTestOutputToTestOutput, TestOutput } from './results';
import { CustomError } from '../../../../errors';
import { IaCErrorCodes } from '../../../../../cli/commands/test/iac/local-execution/types';
import { getErrorStringCode } from '../../../../../cli/commands/test/iac/local-execution/error-utils';
import { CLI } from '@snyk/error-catalog-nodejs-public';

export async function getResultFromOutputFile(
  outputFilePath: string,
): Promise<TestOutput> {
  const results = await readJson(outputFilePath);

  return mapSnykIacTestOutputToTestOutput(results);
}

async function readJson(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath));
  } catch (e) {
    throw new ReadOutputFileError(`invalid output encoding: ${e}`);
  }
}

async function readFile(path: string) {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(path, 'utf-8', (err, content) => {
      if (err) {
        reject(err);
      } else {
        resolve(content);
      }
    });
  });
}

class ReadOutputFileError extends CustomError {
  constructor(message: string) {
    super(message);
    this.code = IaCErrorCodes.PolicyEngineScanError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = 'An error occurred when reading the scan output';
    this.errorCatalog = new CLI.GeneralIACFailureError('');
  }
}
