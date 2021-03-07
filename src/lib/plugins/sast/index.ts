import chalk from 'chalk';
import { getCodeAnalysisAndParseResults } from './analysis';
import { validateCodeTest } from './validate';
import {
  getCodeDisplayedOutput,
  getPrefix,
  getMeta,
} from './format/output-format';
import { EcosystemPlugin } from '../../ecosystems/types';

export const codePlugin: EcosystemPlugin = {
  // We currently don't use scan/display. we will need to consolidate ecosystem plugins
  // to accept flows that act differently in the `testDependencies` step, as we have here
  async scan() {
    return null as any;
  },
  async display() {
    return '';
  },
  async test(paths, options) {
    try {
      await validateCodeTest(options);
      // Currently code supports only one path
      const path = paths[0];
      const sarifTypedResult = await getCodeAnalysisAndParseResults(
        path,
        options,
      );
      const meta = getMeta(options, path);
      const prefix = getPrefix(path);
      const readableResult = getCodeDisplayedOutput(
        sarifTypedResult,
        meta,
        prefix,
      );

      const numOfIssues = sarifTypedResult.runs?.[0].results?.length || 0;
      if (numOfIssues > 0) {
        hasIssues(readableResult);
      }

      return { readableResult };
    } catch (error) {
      let err: Error;
      if (error instanceof Error) {
        err = error;
      } else if (isCodeClientError(error)) {
        err = new Error(chalk.bold.red(error.statusText));
      } else if (error.code >= 400 && error.code < 500) {
        err = new Error(error.message);
      } else {
        err = new Error(error);
      }
      throw err;
    }
  },
};

function isCodeClientError(error: object): boolean {
  return (
    error.hasOwnProperty('statusCode') &&
    error.hasOwnProperty('statusText') &&
    error.hasOwnProperty('apiName')
  );
}

function hasIssues(readableResult: string): Error {
  const err = new Error(readableResult) as any;
  err.code = 'VULNS';

  throw err;
}
