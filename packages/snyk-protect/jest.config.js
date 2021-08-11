module.exports = {
  preset: 'ts-jest',
  testMatch: [
    '<rootDir>/test/**/*.spec.ts',
    '<rootDir>\\test\\**\\*.spec.ts', // for Windows
  ],
};
