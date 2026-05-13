const parseSnykIgnoreFragments = () => {
  const raw = process.env.TEST_SNYK_IGNORE_LIST;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return [];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

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

  const snykFragments = parseSnykIgnoreFragments();

  if (snykFragments.length > 0) {
    console.warn(
      '[acceptance ignore]',
      snykFragments,
      'TEST_SNYK_IGNORE_LIST overrides TEST_SNYK_DONT_SKIP_ANYTHING for matching files.',
    );
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
