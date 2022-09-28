import * as createDebugLogger from 'debug';

import { policyEngineReleaseVersion } from '../local-cache/policy-engine/constants';
import { ResourceKind, TestOutput } from '../scan/results';
import { getIacType, IacType } from './iac-type';

const debugLog = createDebugLogger('snyk-iac');

export interface IacAnalytics {
  packageManager: ResourceKind[];
  'iac-type': IacType;
  'iac-issues-count': number;
  'iac-ignored-issues-count': number;
  'iac-files-count': number;
  'iac-resources-count': number;
  'iac-test-binary-version': string;
  'iac-error-codes': number[];
  // 'iac-rules-bundle-version': string; // TODO: Add when we have the rules bundle version
}

export function addIacAnalytics(testOutput: TestOutput): void {
  const iacAnalytics = computeIacAnalytics(testOutput);

  debugLog(iacAnalytics);
}

export function computeIacAnalytics(testOutput: TestOutput): IacAnalytics {
  const iacType = getIacType(testOutput);

  return {
    'iac-type': iacType,
    packageManager: Object.keys(iacType) as ResourceKind[],
    'iac-issues-count': testOutput.results?.vulnerabilities?.length || 0,
    'iac-ignored-issues-count':
      testOutput.results?.scanAnalytics.ignoredCount || 0,
    'iac-files-count': Object.values(iacType).reduce(
      (acc, packageManagerAnalytics) => acc + packageManagerAnalytics!.count,
      0,
    ),
    'iac-resources-count': testOutput.results?.resources?.length || 0,
    'iac-error-codes':
      [...new Set(testOutput.errors?.map((error) => error.code!))] || [],
    'iac-test-binary-version': policyEngineReleaseVersion,
    // iacAnalytics['iac-rules-bundle-version'] = ''; // TODO: Add when we have the rules bundle version
  };
}
