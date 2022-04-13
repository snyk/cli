import * as pathLib from 'path';

import { IacFileInDirectory } from '../../../../lib/types';

export { getIacDisplayedIssues } from './issues-list';
export { formatIacTestSummary } from './test-summary';

export function getIacDisplayErrorFileOutput(
  iacFileResult: IacFileInDirectory,
): string {
  const fileName = pathLib.basename(iacFileResult.filePath);
  return `

-------------------------------------------------------

Testing ${fileName}...

${iacFileResult.failureReason}`;
}
