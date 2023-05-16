import chalk from 'chalk';
import * as debugLib from 'debug';
import { v4 as uuidv4 } from 'uuid';
import { getCodeTestResults } from './analysis';
import { getSastSettings } from './settings';
import {
  getCodeDisplayedOutput,
  getPrefix,
  getMeta,
} from './format/output-format';
import { EcosystemPlugin } from '../../ecosystems/types';
import { FailedToRunTestError, NoSupportedSastFiles } from '../../errors';
import { CodeClientError } from './errors';
import { jsonStringifyLargeObject } from '../../json';
import * as analytics from '../../analytics';
import * as cloneDeep from 'lodash.clonedeep';

const debug = debugLib('snyk-code');

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
    const requestId = uuidv4();
    debug(`Request ID: ${requestId}`);
    try {
      analytics.add('sast-scan', true);
      const sastSettings = await getSastSettings(options);
      // Currently code supports only one path
      const path = paths[0];

      const testResults = await getCodeTestResults(
        path,
        options,
        sastSettings,
        requestId,
      );

      if (!testResults) {
        throw new NoSupportedSastFiles();
      }

      // cloneDeep is used so the sarif is not changed when using the testResults getting the displayed output
      const sarifTypedResult = cloneDeep(testResults?.analysisResults?.sarif);

      const numOfIssues = sarifTypedResult.runs?.[0].results?.length || 0;
      analytics.add('sast-issues-found', numOfIssues);
      let newOrg = options.org;
      if (!newOrg && sastSettings.org) {
        newOrg = sastSettings.org;
      }
      const meta = getMeta({ ...options, org: newOrg }, path);
      const prefix = getPrefix(path);
      let readableResult = getCodeDisplayedOutput({
        testResults,
        meta,
        prefix,
        shouldFilterIgnored: options['report'] ?? false,
      });

      if (numOfIssues > 0 && options['no-markdown']) {
        sarifTypedResult.runs?.[0].results?.forEach(({ message }) => {
          delete message.markdown;
        });
      }
      let sarifResult: string | undefined;
      if (options['sarif-file-output']) {
        sarifResult = jsonStringifyLargeObject(sarifTypedResult);
      }
      let jsonResult: string | undefined;
      if (options['json-file-output']) {
        jsonResult = jsonStringifyLargeObject(sarifTypedResult);
      }
      if (options.sarif || options.json) {
        readableResult = jsonStringifyLargeObject(sarifTypedResult);
      }
      if (numOfIssues > 0) {
        throwIssuesError({ readableResult, sarifResult, jsonResult });
      }
      return sarifResult ? { readableResult, sarifResult } : { readableResult };
    } catch (error) {
      let err: Error;
      if (isCodeClientError(error)) {
        err = resolveCodeClientError(error);
      } else if (error instanceof Error) {
        err = error;
      } else if (isUnauthorizedError(error)) {
        err = new FailedToRunTestError(error.message, error.code);
      } else {
        err = new Error(error);
      }
      debug(
        chalk.bold.red(
          `requestId: ${requestId} statusCode:${error.code ||
            error.statusCode}, message: ${error.statusText || error.message}`,
        ),
      );
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

const genericErrorHelpMessages = {
  500: "One or more of Snyk's services may be temporarily unavailable.",
  502: "One or more of Snyk's services may be temporarily unavailable.",
};

const apiSpecificErrorHelpMessages = {
  initReport: {
    ...genericErrorHelpMessages,
    400: 'Make sure this feature is enabled by contacting support.',
  },
  getReport: {
    ...genericErrorHelpMessages,
    'Analysis result set too large':
      'The findings for this project may exceed the allowed size limit.',
  },
};

function resolveCodeClientError(error: {
  apiName: string;
  statusCode: number;
  statusText: string;
}): Error {
  // For now only report includes custom client errors
  if (error.apiName === 'initReport' || error.apiName === 'getReport') {
    const additionalHelp =
      apiSpecificErrorHelpMessages[error.apiName][error.statusText] ??
      apiSpecificErrorHelpMessages[error.apiName][error.statusCode];

    return new CodeClientError(
      error.statusCode,
      error.statusText,
      additionalHelp,
    );
  }
  const isUnauthorized = isUnauthorizedError(error) ? 'Unauthorized: ' : '';
  return new FailedToRunTestError(
    `${isUnauthorized}Failed to run 'code test'`,
    error.statusCode,
  );
}

function isUnauthorizedError(error: any): boolean {
  return (
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.code === 403 ||
    error.code === 401
  );
}

function throwIssuesError(args: {
  readableResult: string;
  sarifResult: string | undefined;
  jsonResult: string | undefined;
}): Error {
  const err = new Error(args.readableResult) as any;
  err.code = 'VULNS';
  if (args.sarifResult !== undefined) {
    err.sarifStringifiedResults = args.sarifResult;
  }
  if (args.jsonResult !== undefined) {
    err.jsonStringifiedResults = args.jsonResult;
  }
  throw err;
}
