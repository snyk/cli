const { createJestConfig } = require('./test/createJestConfig');

module.exports = createJestConfig({
  displayName: 'snyk',
  projects: ['<rootDir>', '<rootDir>/packages/*'],
});
