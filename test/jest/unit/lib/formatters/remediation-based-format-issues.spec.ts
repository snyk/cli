import * as fs from 'fs';
const orderBy = require('lodash.orderby');
import * as path from 'path';
import stripAnsi from 'strip-ansi';

import { groupVulnerabilities } from '../../../../../src/lib/formatters/test/format-test-results';
import { formatIssuesWithRemediation } from '../../../../../src/lib/formatters/remediation-based-format-issues';

it('with pins & unfixable & showVulnsPaths = all', () => {
  const withRemediation = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../',
        'acceptance/fixtures/pip-app-with-remediation/test-graph-results.json',
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

it('with showVulnPaths = some', () => {
  const withRemediation = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../',
        'acceptance/fixtures/pip-app-with-remediation/test-graph-results.json',
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
    { showVulnPaths: 'some' },
  );
  expect(
    stripAnsi(res.join('\n').replace(/\[http.*\]/g, '[URL]')),
  ).toMatchSnapshot();
});
it('with upgrades & patches', () => {
  const withRemediation = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../',
        'acceptance/fixtures/npm-package-with-severity-override/test-graph-result-patches.json',
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
it('with reachable info', () => {
  const withRemediation = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../',
        'acceptance/workspaces/reachable-vulns/maven/test-dep-graph-response.json',
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
      path.resolve(
        __dirname,
        '../../../../',
        'acceptance/workspaces/ruby-app/test-graph-response-with-legal-instruction.json',
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
