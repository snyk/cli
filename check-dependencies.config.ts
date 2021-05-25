import type { Options } from 'depcheck';

export const config: Options = {
  ignoreMatches: [
    'sarif', // we only use @types/sarif. https://github.com/depcheck/depcheck/issues/640
    '@types/jest', // jest is a global so impossible to detect usage of types
  ],
  ignoreDirs: ['node_modules', 'dist', 'fixtures', 'test-output'],
};
