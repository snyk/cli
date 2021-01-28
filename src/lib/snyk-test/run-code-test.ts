import * as codeClient from '@snyk/code-client';
import { api } from '../../lib/api-token';
import * as config from '../config';
import spinner = require('../spinner');
import * as analytics from '../analytics';

codeClient.emitter.on('scanFilesProgress', (processed: number) => {
  console.log(`Indexed ${processed} files`);
});

/** Bundle upload process is started with provided data */
codeClient.emitter.on(
  'uploadBundleProgress',
  (processed: number, total: number) => {
    console.log(`Upload bundle progress: ${processed}/${total}`);
  },
);

/** Receives an error object and logs an error message */
codeClient.emitter.on('sendError', (error) => {
  console.log(error);
});

export async function getCodeAnalysisAndParseResults(
  spinnerLbl,
  root,
  options,
) {
  await spinner.clear<void>(spinnerLbl)();
  await spinner(spinnerLbl);

  analytics.add('Code type', true);
  const res = await getCodeAnalysis(root);

  return await parseCodeTestResult(res, options.severityThreshold);
}
export async function getCodeAnalysis(root) {
  let baseURL = config.SNYKCODE_PROXY;
  let sessionToken = api();
  return await codeClient.analyzeFolders(baseURL, sessionToken, false, 1, [
    root,
  ]);
}

export function parseCodeTestResult(result, severityThreshold) {
  console.log(result, severityThreshold);
  //filtering
  return result;
}
