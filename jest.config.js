const { createJestConfig } = require('./test/createJestConfig');

module.exports = createJestConfig({
  displayName: 'coreCli',
  projects: ['<rootDir>', '<rootDir>/packages/*'],
  globalSetup: './test/setup.js',
});
