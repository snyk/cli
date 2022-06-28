import { formatTestEngineFileName } from './utils';

/**
 * The Test Engine release version associated with this Snyk CLI version.
 */
export const testEngineReleaseVersion = '0.2.0';

/**
 * The Test Engine executable's file name.
 */
export const testEngineFileName = formatTestEngineFileName(
  testEngineReleaseVersion,
);
