import * as sarif from 'sarif';
import * as groupBy from 'lodash.groupby';
import * as map from 'lodash.map';

import { SEVERITY, AnnotatedIssue } from '../snyk-test/legacy';

export function getResults(testResult): sarif.Result[] {
  const groupedVulnerabilities = groupBy(testResult.vulnerabilities, 'id');
  return map(
    groupedVulnerabilities,
    ([vuln]): sarif.Result => ({
      ruleId: vuln.id,
      level: getLevel(vuln),
      message: {
        text: `This file introduces a vulnerable ${vuln.packageName} package with a ${vuln.severity} severity vulnerability.`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: testResult.displayTargetFile,
            },
            region: {
              startLine: vuln.lineNumber || 1,
            },
          },
        },
      ],
    }),
  );
}

export function getLevel(vuln: AnnotatedIssue) {
  switch (vuln.severity) {
    case SEVERITY.CRITICAL:
    case SEVERITY.HIGH:
      return 'error';
    case SEVERITY.MEDIUM:
      return 'warning';
    case SEVERITY.LOW:
    default:
      return 'note';
  }
}
