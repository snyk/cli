import * as v1 from './v1';
import * as v2 from './v2';
import { IacTestResponse } from '../../snyk-test/iac-test-result';
import { IacFileInDirectory } from '../../types';

export { formatIacTestSummary } from './v2';

export function getIacDisplayedOutput(
  iacTest: IacTestResponse,
  testedInfoText: string,
  meta: string,
  prefix: string,
  isNewIacOutputSupported?: boolean,
): string {
  return isNewIacOutputSupported
    ? v2.getIacDisplayedOutput(iacTest, testedInfoText, meta, prefix)
    : v1.getIacDisplayedOutput(iacTest, testedInfoText, meta, prefix);
}

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
} from './v1';
