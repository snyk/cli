import * as fs from 'fs';
const orderBy = require('lodash.orderby');
import stripAnsi from 'strip-ansi';
import { groupVulnerabilities } from '../../../../../src/lib/formatters/test/format-test-results';
import { formatIssuesWithRemediation } from '../../../../../src/lib/formatters/remediation-based-format-issues';
import { getFixturePath } from '../../../util/getFixturePath';
import { getWorkspacePath } from '../../../util/getWorkspacePath';

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
    stripAnsi(res.outputTextArray.join('\n').replace(/\[http.*\]/g, '[URL]')),
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
    stripAnsi(res.outputTextArray.join('\n').replace(/\[http.*\]/g, '[URL]')),
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
    stripAnsi(res.outputTextArray.join('\n').replace(/\[http.*\]/g, '[URL]')),
  ).toMatchSnapshot();
});
it('with reachable info', () => {
  const withRemediation = JSON.parse(
    fs.readFileSync(
      getWorkspacePath('reachable-vulns/maven/test-dep-graph-response.json'),
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
    stripAnsi(res.outputTextArray.join('\n').replace(/\[http.*\]/g, '[URL]')),
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
    stripAnsi(res.outputTextArray.join('\n').replace(/\[http.*\]/g, '[URL]')),
  ).toMatchSnapshot();
});
