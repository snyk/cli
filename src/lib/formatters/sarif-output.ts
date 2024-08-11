import * as sarif from 'sarif';
import * as upperFirst from 'lodash.upperfirst';
import { AnnotatedIssue, TestResult } from '../snyk-test/legacy';
import { SEVERITY } from '../snyk-test/legacy';
import { getResults } from './get-sarif-result';
import { getVersion } from '../version';

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
      automationDetails : getAutomationDetails(testResult),
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
      semanticVersion: getVersion(),
      version: getVersion(),
      informationUri: 'https://docs.snyk.io/',
      properties: {
        artifactsScanned: testResult.dependencyCount,
      },
      rules: [],
    },
  };

  if (!testResult.vulnerabilities) {
    return tool;
  }

  const pushedIds = {};
  tool.driver.rules = testResult.vulnerabilities
    .map((vuln: AnnotatedIssue) => {
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
          cvssv3_baseScore: vuln.cvssScore, // AWS
          'security-severity': String(vuln.cvssScore), // GitHub
        },
      };
    })
    .filter(Boolean);
  return tool;
}

// Github anncouned changes to their SARIF upload -- https://github.blog/changelog/2024-05-06-code-scanning-will-stop-combining-runs-from-a-single-upload/
// the impact is when a SARIF that is being uploaded, each run must have unique category, as defined by GitHub here, https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning#runautomationdetails-object
// This presents a new problem of when a file is removed from source since GH will not have an empty result to close any previously opened items since GH open/closes
// based on the SARIF tool.driver.name + Category. Open source's solution is the most obvious, inlcude the targetFile. Snyk-iac, is using this field set to a static "snyk-iac". Combing what
// was being done there with the file name to generate the unique value. Using | as a separator to make it easier to parse out tool vs targetFile. 
function getAutomationDetails(testResult: TestResult)
{
  let automationId = !!process.env.SET_AUTOMATION_DETAILS_ID ? `snyk-container|${testResult.displayTargetFile || testResult.targetFile }/` : ""
  return {
    id : automationId,
  };
}