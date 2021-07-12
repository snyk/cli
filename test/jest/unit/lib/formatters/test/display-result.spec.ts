import * as fs from 'fs';
import * as path from 'path';
import stripAnsi from 'strip-ansi';

import { displayResult } from '../../../../../../src/lib/formatters/test/display-result';

describe('displayResult', () => {
  it('Docker test result', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../../',
          'acceptance/workspaces/fail-on/docker/fixable/vulns.json',
        ),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src', docker: true },
      3,
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('Pip result with pins', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../../',
          'acceptance/fixtures/pip-app-with-remediation/test-graph-results.json',
        ),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src' },
      3,
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('with license issues', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../../',
          'acceptance/workspaces/ruby-app/test-graph-response-with-legal-instruction.json',
        ),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src' },
      3,
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('with Upgrades & Patches', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../../',
          'acceptance/fixtures/npm-package-with-severity-override/test-graph-result-patches.json',
        ),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src' },
      3,
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });
});
