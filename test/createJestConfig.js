const path = require('path');
// Scoped to this folder only so globalSetup is not routed through ts-node for other test/jest/**/*.ts files.
require('ts-node').register({
  transpileOnly: true,
  scope: true,
  scopeDir: path.join(__dirname, 'jest', 'skip-test-list'),
});
const { getSkipTestList } = require('./jest/skip-test-list/getSkipTestList');

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

  const { valid: snykFragments, invalid: invalidIgnoreFragments } =
    getSkipTestList();

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
