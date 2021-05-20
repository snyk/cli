module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {}, // ignore .babelrc file
  collectCoverage: false, // not collecting coverage for now
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['text-summary', 'html'],
  testMatch: [
    '<rootDir>/test/**/*.spec.ts',
    '<rootDir>\\test\\**\\*.spec.ts', // for Windows
  ],
};
