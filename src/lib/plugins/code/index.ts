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
      const readableResult = await getCodeDisplayedOutput(
        sarifTypedResult,
        meta,
        prefix,
      );

      const isVulnerable = sarifTypedResult.runs?.[0].results?.length;
      if (isVulnerable) {
        hasVulnerabilities(readableResult);
      }

      return { readableResult };
    } catch (error) {
      let err: Error;
      if (error instanceof Error) {
        err = error;
      } else if (isCodeClientError(error)) {
        err = new Error(chalk.bold.red(error.statusText));
      } else {
        err = new Error(error);
      }
      throw err;
    }
  },
};

function isCodeClientError(error: any) {
  return (
    error.hasOwnProperty('statusCode') &&
    error.hasOwnProperty('statusText') &&
    error.hasOwnProperty('apiName')
  );
}

function hasVulnerabilities(readableResult) {
  const err = new Error(readableResult) as any;
  err.code = 'VULNS';

  throw err;
}
