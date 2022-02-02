import { Options } from 'depcheck';

export const config: Options = {
  ignoreMatches: [
    'sarif', // we only use @types/sarif. https://github.com/depcheck/depcheck/issues/640
    '@types/jest', // jest is a global so impossible to detect usage of types
    'lerna', // used in circleci
    'ts-loader', // used by webpack
    'node-loader', // used by webpack
    'webpack-cli', // used in package.json scripts
    'pkg', // used for binary builds
    'conventional-changelog-cli', // used for generating release notes
  ],
  ignoreDirs: ['node_modules', 'dist', 'fixtures', 'test-output'],
};
