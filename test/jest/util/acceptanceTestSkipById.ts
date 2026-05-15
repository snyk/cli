/**
 * Optional CircleCI-driven skips for individual acceptance tests: comma-separated stable ids in
 * `TEST_SNYK_SKIP_TEST_IDS` (typically set on context `team-cli-workflow-context`).
 *
 * Path-level skips (`TEST_SNYK_IGNORE_LIST`) supersede this mechanism: ignored specs are not
 * loaded by Jest, so ids inside those paths never run.
 */

import { getSkipTestIds } from './getSkipTestIds';

let cachedSkipIds: ReadonlySet<string> | undefined;

/** Stable ids for specs whose paths match typical `TEST_SNYK_IGNORE_LIST` fragments. */
export const SnykCodeUserJourneyContextSkipIds = {
  GOLANG_NATIVE_IGNORED_ISSUES_SEVERITY_THRESHOLD:
    'snyk-code-user-journey:golang-native:ignored-issues:severity-threshold',
  GOLANG_NATIVE_IGNORED_ISSUES_INCLUDE_IGNORES:
    'snyk-code-user-journey:golang-native:ignored-issues:include-ignores',
  GOLANG_NATIVE_IGNORED_ISSUES_SINGLE_FILE:
    'snyk-code-user-journey:golang-native:ignored-issues:single-file',
} as const;

let skipIdsWarned = false;

function loadSkipIds(): ReadonlySet<string> {
  if (cachedSkipIds !== undefined) {
    return cachedSkipIds;
  }

  const ids = getSkipTestIds();
  if (ids.length === 0) {
    cachedSkipIds = new Set();
    return cachedSkipIds;
  }

  cachedSkipIds = new Set(ids);

  if (!skipIdsWarned) {
    skipIdsWarned = true;
    console.warn(
      '[acceptance skip tests]',
      ids,
      'TEST_SNYK_SKIP_TEST_IDS skips stable ids listed above (only when Jest collects the spec file).',
    );
  }

  return cachedSkipIds;
}

/** Resolve `it` vs `it.skip` using `TEST_SNYK_SKIP_TEST_IDS`. */
export function acceptanceIt(testId: string): jest.It {
  const skip = loadSkipIds().has(testId);
  if (skip) {
    console.warn(
      '[acceptance skip tests]',
      testId,
      'Test id matched TEST_SNYK_SKIP_TEST_IDS; using it.skip.',
    );
  }
  return skip ? it.skip : it;
}
