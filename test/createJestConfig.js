/**
 * Comma-separated env lists (`TEST_SNYK_IGNORE_LIST`, `TEST_SNYK_SKIP_TEST_IDS`): trim, drop empties,
 * validate each fragment as a JavaScript RegExp source (same rule as Jest path patterns).
 * @param {string} raw
 * @returns {{ valid: string[], invalid: string[] }}
 */
function parseSnykIgnoreFragments(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { valid: [], invalid: [] };
  }
  const pieces = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = [];
  const invalid = [];
  for (const f of pieces) {
    try {
      // Validate fragment as a JavaScript RegExp source (same as Jest path patterns).
      // eslint-disable-next-line no-new
      new RegExp(f);
      valid.push(f);
    } catch {
      invalid.push(f);
    }
  }
  return { valid, invalid };
}

function getSkipTestList() {
  const raw = process.env.TEST_SNYK_IGNORE_LIST;
  return parseSnykIgnoreFragments(typeof raw === 'string' ? raw : '');
}

let ignoreFragmentsWarned = false;

const createJestConfig = (config = {}) => {
  const ignorePatterns = [
    '/node_modules/',
    '/dist/',
    '/test/fixtures/',
    '<rootDir>/test/acceptance/workspaces/',
    '<rootDir>/test/tap/',
    '<rootDir>/packages/',
    '<rootDir>/pysrc/',
  ];

  const { valid, invalid } = getSkipTestList();

  if ((valid.length > 0 || invalid.length > 0) && !ignoreFragmentsWarned) {
    ignoreFragmentsWarned = true;
    if (invalid.length > 0) {
      console.warn(
        '[acceptance ignore]',
        'Skipping invalid TEST_SNYK_IGNORE_LIST fragments (must compile as JavaScript RegExp sources):',
        invalid,
      );
    }
    if (valid.length > 0) {
      console.warn(
        '[acceptance ignore]',
        valid,
        'TEST_SNYK_IGNORE_LIST overrides TEST_SNYK_DONT_SKIP_ANYTHING for matching files.',
      );
    }
  }

  const { testPathIgnorePatterns, ...restConfig } = config;
  const extraPathIgnores = Array.isArray(testPathIgnorePatterns)
    ? testPathIgnorePatterns
    : [];

  return {
    preset: 'ts-jest',
    testRegex: '\\.spec\\.ts$',
    testPathIgnorePatterns: [...ignorePatterns, ...valid, ...extraPathIgnores],
    modulePathIgnorePatterns: [...ignorePatterns],
    coveragePathIgnorePatterns: [...ignorePatterns],
    transformIgnorePatterns: [...ignorePatterns],
    ...restConfig,
  };
};

module.exports = {
  createJestConfig,
  parseSnykIgnoreFragments,
};
