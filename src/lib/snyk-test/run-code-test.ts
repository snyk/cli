import * as tsc from '@deepcode/tsc';

tsc.emitter.on('scanFilesProgress', (processed: number) => {
  console.log(`Indexed ${processed} files`);
});

/** Bundle upload process is started with provided data */
tsc.emitter.on('uploadBundleProgress', (processed: number, total: number) => {
  console.log(`Upload bundle progress: ${processed}/${total}`);
});

/** Receives an error object and logs an error message */
tsc.emitter.on('sendError', (error) => {
  console.log(error);
});
export async function getCodeAnalysis(root) {
  let baseURL = `snyk2deepcode-token-exchange.dev.snyk.io`;
  let sessionToken = `insert token here`;
  return await tsc.analyzeFolders(baseURL, sessionToken, false, 1, [root]);
}

export function parseCodeTestResult(result) {
  console.log(result);
}
