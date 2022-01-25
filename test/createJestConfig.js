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
