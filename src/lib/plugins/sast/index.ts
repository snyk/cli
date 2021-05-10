import chalk from 'chalk';
import * as debugLib from 'debug';
import { getCodeAnalysisAndParseResults } from './analysis';
import { validateCodeTest } from './validate';
import {
  getCodeDisplayedOutput,
  getPrefix,
  getMeta,
} from './format/output-format';
import { EcosystemPlugin } from '../../ecosystems/types';
import { FailedToRunTestError } from '../../errors/failed-to-run-test-error';
import { jsonStringifyLargeObject } from '../../json';
import * as analytics from '../../analytics';

const debug = debugLib('snyk-code-test');

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
      analytics.add('sast-scan', true);
      // Currently code supports only one path
      const path = paths[0];
      const sarifTypedResult = await getCodeAnalysisAndParseResults(
        path,
        options,
      );

      const numOfIssues = sarifTypedResult.runs?.[0].results?.length || 0;
      analytics.add('sast-issues-found', numOfIssues);

      if (options.sarif || options.json) {
        if (numOfIssues > 0) {
          hasIssues(jsonStringifyLargeObject(sarifTypedResult));
        }
        return { readableResult: jsonStringifyLargeObject(sarifTypedResult) };
      }
      const meta = getMeta(options, path);
      const prefix = getPrefix(path);
      const readableResult = getCodeDisplayedOutput(
        sarifTypedResult,
        meta,
        prefix,
      );
      if (numOfIssues > 0) {
        hasIssues(readableResult);
      }
      return { readableResult };
    } catch (error) {
      let err: Error;
      if (isCodeClientError(error)) {
        const isUnauthorized = isUnauthorizedError(error)
          ? 'Unauthorized: '
          : '';
        err = new FailedToRunTestError(
          `${isUnauthorized}Failed to run 'code test'`,
          error.statusCode,
        );
      } else if (error instanceof Error) {
        err = error;
      } else if (isUnauthorizedError(error)) {
        err = new FailedToRunTestError(error.message, error.code);
      } else {
        err = new Error(error);
      }
      debug(chalk.bold.red(error.statusText || error.message));
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

function isUnauthorizedError(error: any): boolean {
  return (
    (error.statusCode >= 400 && error.statusCode < 500) ||
    (error.code >= 400 && error.code < 500)
  );
}

function hasIssues(readableResult: string): Error {
  const err = new Error(readableResult) as any;
  err.code = 'VULNS';

  throw err;
}
