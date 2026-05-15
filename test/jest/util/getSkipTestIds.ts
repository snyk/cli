/**
 * Parse `TEST_SNYK_SKIP_TEST_IDS`: comma-separated stable ids, trim, drop empties.
 * Does not cache — callers own caching if they need it once per worker.
 */
export function getSkipTestIds(
  skipTestIds: string | undefined = process.env.TEST_SNYK_SKIP_TEST_IDS,
): readonly string[] {
  if (typeof skipTestIds !== 'string' || skipTestIds.trim() === '') {
    return [];
  }
  return skipTestIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
