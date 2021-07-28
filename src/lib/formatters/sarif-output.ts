import * as sarif from 'sarif';
import { TestResult } from '../snyk-test/legacy';
const upperFirst = require('lodash.upperfirst');

export function createSarifOutputForContainers(
  testResults: TestResult[],
): sarif.Log {
  const sarifRes: sarif.Log = {
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

function getTool(testResult): sarif.Tool {
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
      const level = vuln.severity === 'high' ? 'error' : 'warning';
      const cve = vuln['identifiers']['CVE'][0];
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
          tags: ['security', ...vuln.identifiers.CWE],
        },
      };
    })
    .filter(Boolean);
  return tool;
}

function getResults(testResult): sarif.Result[] {
  const results: sarif.Result[] = [];

  if (!testResult.vulnerabilities) {
    return results;
  }
  testResult.vulnerabilities.forEach((vuln) => {
    results.push({
      ruleId: vuln.id,
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
    });
  });
  return results;
}
