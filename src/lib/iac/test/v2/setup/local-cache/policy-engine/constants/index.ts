import { formatPolicyEngineFileName } from './utils';

/**
 * The Policy Engine release version associated with this Snyk CLI version.
 */
export const policyEngineReleaseVersion = '0.3.0';

/**
 * The Policy Engine executable's file name.
 */
export const policyEngineFileName = formatPolicyEngineFileName(
  policyEngineReleaseVersion,
);
