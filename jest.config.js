const { createJestConfig } = require('./test/createJestConfig');

module.exports = createJestConfig({
  testTimeout: 10000,
  displayName: 'coreCli',
  projects: ['<rootDir>', '<rootDir>/packages/*'],
  globalSetup: './test/setup.js',
});
