module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {}, // ignore .babelrc file
  collectCoverage: false, // not collecting coverage for now
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['text-summary', 'html'],
  testMatch: ['**/*.spec.ts'], // Remove when all tests are using Jest
  modulePathIgnorePatterns: ['<rootDir>/test/.*fixtures'],
};
