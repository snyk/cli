import * as sarif from 'sarif';
import * as upperFirst from 'lodash.upperfirst';
import * as groupBy from 'lodash.groupby';
import * as map from 'lodash.map';

import { TestResult, AnnotatedIssue } from '../snyk-test/legacy';
import { getResults } from './get-sarif-result';
import { getVersion } from '../../lib/version';

const LOCK_FILES_TO_MANIFEST_MAP = {
  'Gemfile.lock': 'Gemfile',
  'package-lock.json': 'package.json',
  'yarn.lock': 'package.json',
  'pnpm-lock.yaml': 'package.json',
  'Gopkg.lock': 'Gopkg.toml',
  'go.sum': 'go.mod',
  'composer.lock': 'composer.json',
  'Podfile.lock': 'Podfile',
  'poetry.lock': 'pyproject.toml',
};

export function createSarifOutputForOpenSource(
  testResults: TestResult[],
): sarif.Log {
  return {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: testResults.map(replaceLockfileWithManifest).map((testResult) => ({
      automationDetails : getAutomationDetails(testResult),
      tool: {
        driver: {
          name: 'Snyk Open Source',
          semanticVersion: getVersion(),
          version: getVersion(),
          informationUri: 'https://docs.snyk.io/',
          properties: {
            artifactsScanned: testResult.dependencyCount,
          },
          rules: getRules(testResult),
        },
      },
      results: getResults(testResult),
    })),
  };
}

// Github anncouned changes to their SARIF upload -- https://github.blog/changelog/2024-05-06-code-scanning-will-stop-combining-runs-from-a-single-upload/
// the impact is when a SARIF that is being uploaded, each run must have unique category, as defined by GitHub here, https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning#runautomationdetails-object
// This presents a new problem of when a file is removed from source since GH will not have an empty result to close any previously opened items since GH open/closes
// based on the SARIF tool.driver.name + Category. Open source's solution is the most obvious, inlcude the targetFile. Snyk-iac, is using this field set to a static "snyk-iac". Combing what
// was being done there with the file name to generate the unique value. Using | as a separator to make it easier to parse out tool vs targetFile. 
function getAutomationDetails(testResult: TestResult)
{
  let automationId = !!process.env.SET_AUTOMATION_DETAILS_ID ? `snyk-sca|${testResult.displayTargetFile || testResult.targetFile }/` : ""
  return {
    id : automationId,
  };
}

function replaceLockfileWithManifest(testResult: TestResult): TestResult {
  let targetFile = testResult.displayTargetFile || '';
  for (const [key, replacer] of Object.entries(LOCK_FILES_TO_MANIFEST_MAP)) {
    targetFile = targetFile.replace(new RegExp(key, 'g'), replacer);
  }
  return {
    ...testResult,
    vulnerabilities: testResult.vulnerabilities || [],
    displayTargetFile: targetFile,
  };
}

export function getRules(testResult: TestResult): sarif.ReportingDescriptor[] {
  const groupedVulnerabilities = groupBy(testResult.vulnerabilities, 'id');
  return map(
    groupedVulnerabilities,
    ([vuln, ...moreVulns]: AnnotatedIssue[]): sarif.ReportingDescriptor => {
      const cves = vuln.identifiers?.CVE?.join();
      return {
        id: vuln.id,
        shortDescription: {
          text: `${upperFirst(vuln.severity)} severity - ${
            vuln.title
          } vulnerability in ${vuln.packageName}`,
        },
        fullDescription: {
          text: cves
            ? `(${cves}) ${vuln.name}@${vuln.version}`
            : `${vuln.name}@${vuln.version}`,
        },
        help: {
          text: '',
          markdown: `* Package Manager: ${testResult.packageManager}
* ${vuln.type === 'license' ? 'Module' : 'Vulnerable module'}: ${vuln.name}
* Introduced through: ${getIntroducedThrough(vuln)}
#### Detailed paths
${[vuln, ...moreVulns]
  .map((item) => `* _Introduced through_: ${item.from.join(' › ')}`)
  .join('\n')}
${vuln.description}`.replace(/##\s/g, '# '),
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
    },
  );
}

function getIntroducedThrough(vuln: AnnotatedIssue) {
  const [firstFrom, secondFrom] = vuln.from || [];

  return vuln.from.length > 2
    ? `${firstFrom}, ${secondFrom} and others`
    : vuln.from.length === 2
      ? `${firstFrom} and ${secondFrom}`
      : firstFrom;
}
