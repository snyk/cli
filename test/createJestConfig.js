const createJestConfig = (config) => {
  const ignorePatterns = [
    '/node_modules/',
    '/dist/',
    '/test/fixtures/',
    '<rootDir>/test/acceptance/workspaces/',
    '<rootDir>/test/tap/',
    '<rootDir>/packages/',
    '<rootDir>/pysrc/',
  ];

  return {
    snapshotFormat: {
      // Jest 29 changed these defaults, see: https://jestjs.io/docs/upgrading-to-jest29#snapshot-format
      escapeString: true,
      printBasicPrototype: true,
    },
    preset: 'ts-jest',
    testRegex: '\\.spec\\.ts$',
    testPathIgnorePatterns: [...ignorePatterns],
    modulePathIgnorePatterns: [...ignorePatterns],
    coveragePathIgnorePatterns: [...ignorePatterns],
    transformIgnorePatterns: [...ignorePatterns],
    ...config,
  };
};

module.exports = {
  createJestConfig,
};
