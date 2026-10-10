import * as path from 'path';

export const CLI_BIN_PATH = path.resolve(__dirname, '../../../bin/snyk');

/**
 * CLI timeout, in seconds, for user journey tests. A run that takes longer
 * fails with exit code 69 (`EX_UNAVAILABLE`) and error `SNYK-CLI-0026`, and
 * still sends analytics for the run.
 *
 * @example
 * ```ts
 * const env = {
 *   ...process.env,
 *   SNYK_TIMEOUT_SECS: USER_JOURNEY_CLI_TIMEOUT_SECS,
 * };
 * ```
 */
export const USER_JOURNEY_CLI_TIMEOUT_SECS = '450';

/**
 * Jest timeout, in milliseconds, for user journey tests. It must exceed
 * {@link USER_JOURNEY_CLI_TIMEOUT_SECS} plus the CLI's grace period and
 * teardown, otherwise Jest fails the test before the CLI sends analytics.
 *
 * @example
 * ```ts
 * jest.setTimeout(USER_JOURNEY_JEST_TIMEOUT_MS);
 * ```
 */
export const USER_JOURNEY_JEST_TIMEOUT_MS =
  (Number(USER_JOURNEY_CLI_TIMEOUT_SECS) + 60) * 1000;
