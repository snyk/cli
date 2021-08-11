module.exports = {
  preset: 'ts-jest',
  testMatch: [
    '<rootDir>/test/*.spec.ts',
    '<rootDir>/test/iac-unit-tests/*.spec.ts',
    '<rootDir>/packages/**/test/**/*.spec.ts',
    '<rootDir>/test/jest/unit/**/*.spec.ts',
    '<rootDir>/test/jest/system/**/*.spec.ts',
    '<rootDir>/test/jest/acceptance/**/*.spec.ts',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/test/.*fixtures/*',
    '<rootDir>/packages/.+/test/.*fixtures/*',
    '<rootDir>/test/acceptance/*',
    '<rootDir>/test/acceptance/workspaces/*', // to avoid `jest-haste-map: Haste module naming collision` errors
  ],
};
