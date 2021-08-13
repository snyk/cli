import { Options } from 'depcheck';

export const config: Options = {
  ignoreMatches: [
    'sarif', // we only use @types/sarif. https://github.com/depcheck/depcheck/issues/640
    '@types/jest', // jest is a global so impossible to detect usage of types
    'jest-junit', // used in circleci
    'tap-junit', // used in circleci
    'lerna', // used in circleci
    'ts-loader', // Implicitly called build tools
    'webpack-cli', // Implicitly called build tools
  ],
  ignoreDirs: ['node_modules', 'dist', 'fixtures', 'test-output'],
};
