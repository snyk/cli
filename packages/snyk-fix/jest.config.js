const sharedConfig = require('../../jest.config.js');

module.exports = {
  ...sharedConfig,
  'rootDir': './',
  collectCoverage: true, // not collecting coverage for now
  collectCoverageFrom: ['src/**/*.spec.ts'],
  coverageReporters: ['text-summary', 'html'],
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"]
};
