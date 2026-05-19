/**
 * Optional CircleCI-driven skips for individual acceptance tests: comma-separated stable ids in
 * `TEST_SNYK_SKIP_TEST_IDS` (typically set on context `team-cli-workflow-context`). Entries are parsed
 * with the same rules as `TEST_SNYK_IGNORE_LIST` fragments (trim, drop empties, each segment must be a
 * valid JavaScript `RegExp` source).
 *
 * Path-level skips (`TEST_SNYK_IGNORE_LIST`) supersede this mechanism: ignored specs are not
 * loaded by Jest, so ids inside those paths never run.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
// `test/createJestConfig.js` is CommonJS; keep a single shared parser for env comma-lists.
const { parseSnykIgnoreFragments } = require('../../createJestConfig') as {
  parseSnykIgnoreFragments: (raw: string) => {
    valid: string[];
    invalid: string[];
  };
};

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

  const raw = process.env.TEST_SNYK_SKIP_TEST_IDS;
  if (typeof raw !== 'string' || raw.trim() === '') {
    cachedSkipIds = new Set();
    return cachedSkipIds;
  }

  const { valid: ids, invalid } = parseSnykIgnoreFragments(raw);
  cachedSkipIds = new Set(ids);

  if (!skipIdsWarned && (ids.length > 0 || invalid.length > 0)) {
    skipIdsWarned = true;
    if (invalid.length > 0) {
      console.warn(
        '[acceptance skip tests]',
        'Skipping invalid TEST_SNYK_SKIP_TEST_IDS entries (must compile as JavaScript RegExp sources):',
        invalid,
      );
    }
    if (ids.length > 0) {
      console.warn(
        '[acceptance skip tests]',
        ids,
        'TEST_SNYK_SKIP_TEST_IDS skips stable ids listed above (only when Jest collects the spec file).',
      );
    }
  }

  return cachedSkipIds;
}

/** Resolve `it` vs `it.skip` using `TEST_SNYK_SKIP_TEST_IDS`. */
export function acceptanceIt(testId: string): jest.It {
  const skip = loadSkipIds().has(testId);
  if (skip) {
    console.info('[acceptance skip tests]', 'skip', testId);
  }
  return skip ? it.skip : it;
}
