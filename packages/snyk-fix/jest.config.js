module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: false, // not collecting coverage for now
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['text-summary', 'html'],
};
