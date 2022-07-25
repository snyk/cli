import { formatPolicyEngineFileName, getChecksum } from './utils';

/**
 * The Policy Engine release version associated with this Snyk CLI version.
 */
export const policyEngineReleaseVersion = '0.8.0';

/**
 * The Policy Engine executable's file name.
 */
export const policyEngineFileName = formatPolicyEngineFileName(
  policyEngineReleaseVersion,
);

export const policyEngineChecksum = getChecksum(policyEngineFileName);
