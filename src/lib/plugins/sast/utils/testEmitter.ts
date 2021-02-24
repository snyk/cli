import { emitter as codeEmitter } from '@snyk/code-client';
import spinner = require('../../../spinner');

export function analysisProgressUpdate(currentLabel: string) {
  codeEmitter.on('scanFilesProgress', async (processed: number) => {
    const spinnerLbl = `Prepare ${processed} files to upload`;
    spinner.clear<void>(currentLabel)();
    currentLabel = spinnerLbl;
    await spinner(spinnerLbl);
  });
  codeEmitter.on(
    'uploadBundleProgress',
    async (processed: number, total: number) => {
      const spinnerLbl = `Upload progress: ${processed}/${total}`;
      spinner.clear<void>(currentLabel)();
      currentLabel = spinnerLbl;
      await spinner(spinnerLbl);
    },
  );
  codeEmitter.on('analyseProgress', async (data: any) => {
    const spinnerLbl = `Analysis: ${Math.round(data.progress * 100)}%`;
    spinner.clear<void>(currentLabel)();
    currentLabel = spinnerLbl;
    await spinner(spinnerLbl);
  });

  codeEmitter.on('sendError', (error) => {
    throw error;
  });
  return currentLabel;
}
