import * as sarif from 'sarif';
import * as upperFirst from 'lodash.upperfirst';
import { TestResult } from '../snyk-test/legacy';
import { SEVERITY } from '../snyk-test/legacy';
import { getResults } from './get-sarif-result';

export function createSarifOutputForContainers(
  testResults: TestResult[],
): sarif.Log {
  const sarifRes: sarif.Log = {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [],
  };

  testResults.forEach((testResult) => {
    sarifRes.runs.push({
      tool: getTool(testResult),
      results: getResults(testResult),
    });
  });

  return sarifRes;
}

export function getIssueLevel(
  severity: SEVERITY | 'none',
): sarif.ReportingConfiguration.level {
  return severity === SEVERITY.HIGH || severity === SEVERITY.CRITICAL
    ? 'error'
    : 'warning';
}

export function getTool(testResult): sarif.Tool {
  const tool: sarif.Tool = {
    driver: {
      name: 'Snyk Container',
      rules: [],
    },
  };

  if (!testResult.vulnerabilities) {
    return tool;
  }

  const pushedIds = {};
  tool.driver.rules = testResult.vulnerabilities
    .map((vuln) => {
      if (pushedIds[vuln.id]) {
        return;
      }
      const level = getIssueLevel(vuln.severity);
      const cve = vuln.identifiers?.CVE?.join();
      pushedIds[vuln.id] = true;
      return {
        id: vuln.id,
        shortDescription: {
          text: `${upperFirst(vuln.severity)} severity - ${
            vuln.title
          } vulnerability in ${vuln.packageName}`,
        },
        fullDescription: {
          text: cve
            ? `(${cve}) ${vuln.name}@${vuln.version}`
            : `${vuln.name}@${vuln.version}`,
        },
        help: {
          text: '',
          markdown: vuln.description,
        },
        defaultConfiguration: {
          level: level,
        },
        properties: {
          tags: [
            'security',
            ...(vuln.identifiers?.CWE || []),
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            testResult.packageManager!,
          ],
        },
      };
    })
    .filter(Boolean);
  return tool;
}
