export interface SkipTestListResult {
  readonly valid: string[];
  readonly invalid: string[];
}

function isValidRegExpSource(source: string): boolean {
  try {
    RegExp(source);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse `TEST_SNYK_IGNORE_LIST`: comma-separated Jest path-ignore fragments (RegExp sources), trim, drop empties.
 * Partitions into fragments that compile as JavaScript `RegExp` and those that do not.
 */
export function getSkipTestList(
  raw: string | undefined = process.env.TEST_SNYK_IGNORE_LIST,
): SkipTestListResult {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { valid: [], invalid: [] };
  }
  const fragments = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const fragment of fragments) {
    if (isValidRegExpSource(fragment)) {
      valid.push(fragment);
    } else {
      invalid.push(fragment);
    }
  }
  return { valid, invalid };
}
