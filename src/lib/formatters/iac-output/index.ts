import * as v1 from './v1';
import * as v2 from './v2';
import { IacFileInDirectory } from '../../types';

export function getIacDisplayErrorFileOutput(
  iacFileResult: IacFileInDirectory,
  isNewIacOutputSupported?: boolean,
): string {
  return isNewIacOutputSupported
    ? v2.getIacDisplayErrorFileOutput(iacFileResult)
    : v1.getIacDisplayErrorFileOutput(iacFileResult);
}

export {
  capitalizePackageManager,
  createSarifOutputForIac,
  shareResultsOutput,
  getIacDisplayedOutput,
} from './v1';

export { formatIacTestSummary, getIacDisplayedIssues } from './v2';
