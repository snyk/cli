function parseSnykIgnoreFragments() {
  const raw = process.env.TEST_SNYK_IGNORE_LIST;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return [];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True if `source` is a valid JavaScript RegExp pattern (Jest compiles ignore patterns this way). */
function isValidRegExpSource(source) {
  try {
    RegExp(source);
    return true;
  } catch {
    return false;
  }
}

function partitionIgnoreFragments(fragments) {
  const valid = [];
  const invalid = [];
  for (const fragment of fragments) {
    if (isValidRegExpSource(fragment)) {
      valid.push(fragment);
    } else {
      invalid.push(fragment);
    }
  }
  return { valid, invalid };
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

  const parsedFragments = parseSnykIgnoreFragments();
  const { valid: snykFragments, invalid: invalidIgnoreFragments } =
    partitionIgnoreFragments(parsedFragments);

  if (
    (snykFragments.length > 0 || invalidIgnoreFragments.length > 0) &&
    !ignoreFragmentsWarned
  ) {
    ignoreFragmentsWarned = true;
    if (invalidIgnoreFragments.length > 0) {
      console.warn(
        '[acceptance ignore]',
        'Skipping invalid TEST_SNYK_IGNORE_LIST fragments (must compile as JavaScript RegExp sources):',
        invalidIgnoreFragments,
      );
    }
    if (snykFragments.length > 0) {
      console.warn(
        '[acceptance ignore]',
        snykFragments,
        'TEST_SNYK_IGNORE_LIST overrides TEST_SNYK_DONT_SKIP_ANYTHING for matching files.',
      );
    }
  }

  const { testPathIgnorePatterns: configTestPathIgnores, ...restConfig } =
    config;
  const extraPathIgnores = Array.isArray(configTestPathIgnores)
    ? configTestPathIgnores
    : [];

  return {
    preset: 'ts-jest',
    testRegex: '\\.spec\\.ts$',
    testPathIgnorePatterns: [
      ...ignorePatterns,
      ...snykFragments,
      ...extraPathIgnores,
    ],
    modulePathIgnorePatterns: [...ignorePatterns],
    coveragePathIgnorePatterns: [...ignorePatterns],
    transformIgnorePatterns: [...ignorePatterns],
    ...restConfig,
  };
};

module.exports = {
  createJestConfig,
};
