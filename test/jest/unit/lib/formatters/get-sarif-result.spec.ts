import { getResults } from '../../../../../src/lib/formatters/get-sarif-result';
import { SEVERITY, TestResult } from '../../../../../src/lib/snyk-test/legacy';

describe('Retrieving sarif result', () => {
  it('should use the test results path as the location uri when target file is not present', () => {
    let result = getResults(
      getTestResult({
        path: 'alpine:3.18.0',
      }),
    );
    expect(result).toEqual([
      {
        ruleId: 'SNYK-LINUX-EXPAT-450908',
        level: 'error',
        message: {
          text:
            'This file introduces a vulnerable expat package with a critical severity vulnerability.',
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: 'alpine:3.18.0' },
              region: { startLine: 1 },
            },
          },
        ],
      },
    ]);

    result = getResults(
      getTestResult({
        path: 'alpine:3.18.0',
        displayTargetFile: undefined,
      }),
    );
    expect(result).toEqual([
      {
        ruleId: 'SNYK-LINUX-EXPAT-450908',
        level: 'error',
        message: {
          text:
            'This file introduces a vulnerable expat package with a critical severity vulnerability.',
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: 'alpine:3.18.0' },
              region: { startLine: 1 },
            },
          },
        ],
      },
    ]);

    result = getResults(
      getTestResult({
        path: 'alpine:3.18.0',
        displayTargetFile: null,
      }),
    );
    expect(result).toEqual([
      {
        ruleId: 'SNYK-LINUX-EXPAT-450908',
        level: 'error',
        message: {
          text:
            'This file introduces a vulnerable expat package with a critical severity vulnerability.',
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: 'alpine:3.18.0' },
              region: { startLine: 1 },
            },
          },
        ],
      },
    ]);
  });

  it('should use the target file as the location uri when target file is present', () => {
    const actualResult = getResults(
      getTestResult({
        displayTargetFile: 'Dockerfile.test',
      }),
    );
    expect(actualResult).toEqual([
      {
        ruleId: 'SNYK-LINUX-EXPAT-450908',
        level: 'error',
        message: {
          text:
            'This file introduces a vulnerable expat package with a critical severity vulnerability.',
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: 'Dockerfile.test' },
              region: { startLine: 1 },
            },
          },
        ],
      },
    ]);
  });
});

function getTestResult(testResultOverride = {}, vulnOverride = {}): TestResult {
  return {
    vulnerabilities: [
      {
        id: 'SNYK-LINUX-EXPAT-450908',
        packageName: 'expat',
        version: '2.2.5-r0',
        below: '',
        semver: {
          vulnerable: ['<2.2.7-r0'],
        },
        patches: [],
        isNew: false,
        description: '## Overview\nIn libexpat in Expat before 2.2.7...',
        title: 'XML External Entity (XXE) Injection',
        severity: SEVERITY.CRITICAL,
        fixedIn: ['2.2.7-r0'],
        credit: [''],
        name: 'expat',
        from: [
          'docker-image|garethr/snyky@alpine',
          '.python-rundeps@0',
          'expat@2.2.5-r0',
        ],
        upgradePath: [],
        isUpgradable: false,
        isPatchable: false,
        parentDepType: 'prod',
        identifiers: {
          ALTERNATIVE: [
            'SNYK-DEBIAN8-EXPAT-450909',
            'SNYK-DEBIAN9-EXPAT-450910',
          ],
          CVE: ['CVE-2018-20843'],
          CWE: ['CWE-611'],
        },
        ...vulnOverride,
      },
    ],
    ok: false,
    dependencyCount: 969,
    org: 'ORG',
    policy: '',
    isPrivate: true,
    licensesPolicy: null,
    ignoreSettings: null,
    summary: '165 vulnerable dependencies',
    ...testResultOverride,
  };
}
