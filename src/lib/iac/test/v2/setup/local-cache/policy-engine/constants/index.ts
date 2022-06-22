import { formatPolicyEngineFileName } from './utils';

/**
 * The Policy Engine release version associated with this Snyk CLI version.
 */
export const releaseVersion = '0.1.0';

/**
 * The Policy Engine executable's file name.
 */
export const policyEngineFileName = formatPolicyEngineFileName(releaseVersion);
