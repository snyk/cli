import stripAnsi = require('strip-ansi');

import { summariseErrorResults } from '../../../../../src/lib/formatters';

describe('summariseErrorResults', () => {
  it('Single test result', () => {
    expect(stripAnsi(summariseErrorResults(1))).toMatchSnapshot();
  });

  it('Multiple test results', () => {
    expect(stripAnsi(summariseErrorResults(4))).toMatchSnapshot();
  });
});
