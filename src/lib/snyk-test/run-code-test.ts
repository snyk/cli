import { AnalysisSeverity, analyzeFolders } from '@snyk/code-client';
import { Log } from 'sarif';
import { SEVERITY } from './legacy';
import { api } from '../api-token';
import * as config from '../config';
import spinner = require('../spinner');
import { Options } from '../types';

// codeClient.emitter.on('scanFilesProgress', (processed: number) => {
//   console.log(`Indexed ${processed} files`);
// });

// /** Bundle upload process is started with provided data */
// codeClient.emitter.on(
//   'uploadBundleProgress',
//   (processed: number, total: number) => {
//     console.log(`Upload bundle progress: ${processed}/${total}`);
//   },
// );

// /** Receives an error object and logs an error message */
// codeClient.emitter.on('sendError', (error) => {
//   console.log(error);
// });
export async function getCodeAnalysisAndParseResults(
  spinnerLbl: string,
  root: string,
  options: Options,
): Promise<Log> {
  await spinner.clear<void>(spinnerLbl)();
  await spinner(spinnerLbl);

  return await getCodeAnalysis(root, options);
}

async function getCodeAnalysis(root: string, options: Options): Promise<Log> {
  const baseURL = config.SNYKCODE_PROXY;
  const sessionToken = api();

  const includeLint = false;
  const severityLevel = options.severityThreshold
    ? severityToAnalysisSeverity(options.severityThreshold)
    : AnalysisSeverity.info;
  const paths: string[] = [root];
  const symlinksEnabled = false;
  const maxPayload = undefined;
  const defaultFileIgnores = undefined;
  const sarif = true;

  const result = await analyzeFolders(
    baseURL,
    sessionToken,
    includeLint,
    severityLevel,
    paths,
    symlinksEnabled,
    maxPayload,
    defaultFileIgnores,
    sarif,
  );

  return result.sarifResults!;
}

function severityToAnalysisSeverity(severity: SEVERITY): AnalysisSeverity {
  const severityLevel = {
    low: 1,
    medium: 2,
    high: 3,
  };
  return severityLevel[severity];
}
