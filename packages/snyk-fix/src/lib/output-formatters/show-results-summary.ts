import { FixHandlerResultByPlugin } from '../../plugins/types';

export async function showResultsSummary(
  resultsByPlugin: FixHandlerResultByPlugin,
  exceptionsByScanType: { [ecosystem: string]: Error[] },
): Promise<void> {
  let summarySuccessMessage = 'Following projects had fixes applied:\n\n';
  let summaryErrorsMessage = '';
  let summarySkippedMessage = 'Following projects were skipped:\n';
  let containsFixed = false;
  let containsSkipped = false;

  for (const plugin of Object.keys(resultsByPlugin)) {
    const fixedSuccessfully = resultsByPlugin[plugin].succeeded;
    const skipped = resultsByPlugin[plugin].skipped;

    if (fixedSuccessfully.length > 0) {
      containsFixed = true;
      summarySuccessMessage += `${fixedSuccessfully
        .map((s) => s.userMessage)
        .join('\n')}`;
    }
    if (skipped.length > 0) {
      containsSkipped = true;
      summarySkippedMessage += `${resultsByPlugin[plugin].skipped
        .map((s) => s.userMessage)
        .join('\n')}`;
    }
  }

  if (Object.keys(exceptionsByScanType).length) {
    for (const ecosystem of Object.keys(exceptionsByScanType)) {
      summaryErrorsMessage += `Errors while trying to process ${ecosystem} projects:\n ${exceptionsByScanType[
        ecosystem
      ]
        .map((e) => e.message)
        .join('\n')}\n`;
    }
  }
  // TODO: return this / use ora?
  console.log(
    `Fix summary:\n${containsFixed ? `${summarySuccessMessage}\n` : ''}${
      containsSkipped ? `${summarySkippedMessage}\n` : ''
    }${summaryErrorsMessage}`,
  );
}
