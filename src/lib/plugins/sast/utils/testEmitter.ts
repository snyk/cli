import { emitter as codeEmitter } from '@snyk/code-client';
import * as spinner from '../../../spinner';

export function analysisProgressUpdate(): void {
  let currentMessage = '';
  const showSpinner = (message: string): Promise<void> | undefined => {
    if (currentMessage === message) return;

    spinner.clear<void>(currentMessage)();
    currentMessage = message;
    return spinner(message);
  };

  codeEmitter.on('supportedFilesLoaded', () =>
    showSpinner(`Supported extensions loaded`),
  );
  codeEmitter.on('scanFilesProgress', (processed: number) =>
    showSpinner(`Scanning files: ${Math.round(processed / 100)}00`),
  );
  codeEmitter.on('createBundleProgress', (processed: number, total: number) =>
    showSpinner(`Batching file upload: ${processed} / ${total}`),
  );
  codeEmitter.on('uploadBundleProgress', (processed: number, total: number) =>
    showSpinner(`Upload progress: ${processed} / ${total}`),
  );
  codeEmitter.on('analyseProgress', (data: any) =>
    showSpinner(`Analysis: ${Math.round(data.progress * 100)}%`),
  );
  codeEmitter.on('sendError', (error) => {
    throw error;
  });
}
