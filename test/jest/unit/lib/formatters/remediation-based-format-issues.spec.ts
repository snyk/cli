import * as fs from 'fs';
const orderBy = require('lodash.orderby');
import stripAnsi = require('strip-ansi');
import { groupVulnerabilities } from '../../../../../src/lib/formatters/test/format-test-results';
import { formatIssuesWithRemediation } from '../../../../../src/lib/formatters/remediation-based-format-issues';
import { getFixturePath } from '../../../util/getFixturePath';
import { getWorkspacePath } from '../../../util/getWorkspacePath';

describe('formatIssuesWithRemediation', () => {
  it('with pins & unfixable & showVulnsPaths = all', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getFixturePath('pip-app-with-remediation/test-graph-results.json'),
        'utf8',
      ),
    );
    const groupedVulns = groupVulnerabilities(withRemediation.vulnerabilities);

    const sortedGroupedVulns = orderBy(
      groupedVulns,
      ['metadata.severityValue', 'metadata.name'],
      ['asc', 'desc'],
    );

    const res = formatIssuesWithRemediation(
      sortedGroupedVulns,
      withRemediation.remediation,
      { showVulnPaths: 'all' },
    );
    expect(
      stripAnsi(res.join('\n').replace(/\[http.*\]/g, '[URL]')),
    ).toMatchSnapshot();
  });

  it('with showVulnPaths = some', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getFixturePath('pip-app-with-remediation/test-graph-results.json'),
        'utf8',
      ),
    );
    const groupedVulns = groupVulnerabilities(withRemediation.vulnerabilities);

    const sortedGroupedVulns = orderBy(
      groupedVulns,
      ['metadata.severityValue', 'metadata.name'],
      ['asc', 'desc'],
    );

    const res = formatIssuesWithRemediation(
      sortedGroupedVulns,
      withRemediation.remediation,
      { showVulnPaths: 'some' },
    );
    expect(
      stripAnsi(res.join('\n').replace(/\[http.*\]/g, '[URL]')),
    ).toMatchSnapshot();
  });

  it('with upgrades & patches', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getFixturePath(
          'npm-package-with-severity-override/test-graph-result-patches.json',
        ),
        'utf8',
      ),
    );
    const groupedVulns = groupVulnerabilities(withRemediation.vulnerabilities);

    const sortedGroupedVulns = orderBy(
      groupedVulns,
      ['metadata.severityValue', 'metadata.name'],
      ['asc', 'desc'],
    );

    const res = formatIssuesWithRemediation(
      sortedGroupedVulns,
      withRemediation.remediation,
      { showVulnPaths: 'all' },
    );
    expect(
      stripAnsi(res.join('\n').replace(/\[http.*\]/g, '[URL]')),
    ).toMatchSnapshot();
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
    const groupedVulns = groupVulnerabilities(withRemediation.vulnerabilities);

    const sortedGroupedVulns = orderBy(
      groupedVulns,
      ['metadata.severityValue', 'metadata.name'],
      ['asc', 'desc'],
    );

    const res = formatIssuesWithRemediation(
      sortedGroupedVulns,
      withRemediation.remediation,
      { showVulnPaths: 'all' },
    );
    expect(
      stripAnsi(res.join('\n').replace(/\[http.*\]/g, '[URL]')),
    ).toMatchSnapshot();
  });

  it('includes severity change reason', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getFixturePath('sca-dep-graph-with-annotation/test-graph-results.json'),
        'utf8',
      ),
    );
    const groupedVulns = groupVulnerabilities(withRemediation.vulnerabilities);

    const sortedGroupedVulns = orderBy(
      groupedVulns,
      ['metadata.severityValue', 'metadata.name'],
      ['asc', 'desc'],
    );

    const res = formatIssuesWithRemediation(
      sortedGroupedVulns,
      withRemediation.remediation,
      { showVulnPaths: 'all' },
    );
    const plainText = res.join('\n');
    expect(plainText).toContain('Severity reason: Not a long running service');

    // Severity reason should only appear when attribute is present
    const rgex = new RegExp(/Severity reason/, 'g');
    expect(plainText.match(rgex)).toHaveLength(1);
  });

  it('includes user note and reason when available', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        getFixturePath(
          'sca-dep-graph-with-annotation/test-graph-user-note-results.json',
        ),
        'utf8',
      ),
    );
    const groupedVulns = groupVulnerabilities(withRemediation.vulnerabilities);

    const sortedGroupedVulns = orderBy(
      groupedVulns,
      ['metadata.severityValue', 'metadata.name'],
      ['asc', 'desc'],
    );

    const res = formatIssuesWithRemediation(
      sortedGroupedVulns,
      withRemediation.remediation,
      { showVulnPaths: 'all' },
    );
    const plainText = res.join('\n');
    expect(plainText).toContain('User note: Papercut');
    expect(plainText).toContain(
      'Note reason: This vulnerability is a papercut and can be ignored',
    );

    // User note should only appear when attribute is present
    const rgex = new RegExp(/User note/, 'g');
    expect(plainText.match(rgex)).toHaveLength(1);

    const rgex2 = new RegExp(/Note reason/, 'g');
    expect(plainText.match(rgex2)).toHaveLength(1);
  });
});
