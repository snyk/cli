import * as fs from 'fs';
import stripAnsi from 'strip-ansi';
import { displayResult } from '../../../../../../src/lib/formatters/test/display-result';
import { getWorkspacePath } from '../../../../util/getWorkspacePath';
import { getFixturePath } from '../../../../util/getFixturePath';

describe('displayResult', () => {
  it('Pip result with pins', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getFixturePath('pip-app-with-remediation/test-graph-results.json'),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src' },
      3,
    );
    expect(stripAnsi(res).replace(/\[http.*\]/g, '[URL]')).toMatchSnapshot();
  });

  it('with license issues', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getWorkspacePath(
          'ruby-app/test-graph-response-with-legal-instruction.json',
        ),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src' },
      3,
    );
    expect(stripAnsi(res).replace(/\[http.*\]/g, '[URL]')).toMatchSnapshot();
  });

  it('with Upgrades & Patches', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getFixturePath(
          'npm-package-with-severity-override/test-graph-result-patches.json',
        ),
        'utf8',
      ),
    );

    const res = displayResult(
      withRemediation,
      { showVulnPaths: 'all', path: 'src' },
      3,
    );
    expect(stripAnsi(res).replace(/\[http.*\]/g, '[URL]')).toMatchSnapshot();
  });
});
