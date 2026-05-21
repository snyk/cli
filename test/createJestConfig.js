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

/**
 *
 * @param config
 * @returns {{}}
 */
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

  const mergedTestPathIgnorePatterns = [
    ...ignorePatterns,
    ...snykIgnoreListPatterns,
    ...(Array.isArray(config?.testPathIgnorePatterns)
      ? config.testPathIgnorePatterns
      : []),
  ];

  let newConfig = {
    ...config,
    testPathIgnorePatterns: mergedTestPathIgnorePatterns,
  };

  Object.assign(newConfig, {
    preset: newConfig.preset || 'ts-jest',
    testRegex: newConfig.testRegex || '\\.spec\\.ts$',
    testPathIgnorePatterns: mergedTestPathIgnorePatterns,
    modulePathIgnorePatterns: mergedTestPathIgnorePatterns,
    coveragePathIgnorePatterns: mergedTestPathIgnorePatterns,
    transformIgnorePatterns: mergedTestPathIgnorePatterns,
  });

  return newConfig;
};

module.exports = {
  createJestConfig,
};
