/**
 * `TEST_SNYK_IGNORE_LIST`: comma-separated segments, trimmed, empties dropped.
 * Passed through to Jest `testPathIgnorePatterns` as-is (Jest applies its own matching).
 * @returns {string[]}
 */
function getTestSnykIgnoreListPatterns() {
  const raw = process.env.TEST_SNYK_IGNORE_LIST;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return [];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

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

  const snykIgnoreListPatterns = getTestSnykIgnoreListPatterns();

  const { testPathIgnorePatterns, ...restConfig } = config;
  const extraPathIgnores = Array.isArray(testPathIgnorePatterns)
    ? testPathIgnorePatterns
    : [];

  return {
    preset: 'ts-jest',
    testRegex: '\\.spec\\.ts$',
    testPathIgnorePatterns: [
      ...ignorePatterns,
      ...snykIgnoreListPatterns,
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
