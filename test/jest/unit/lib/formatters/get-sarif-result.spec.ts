import { getResults } from '../../../../../src/lib/formatters/get-sarif-result';
import { SEVERITY, TestResult } from '../../../../../src/lib/snyk-test/legacy';

describe('Retrieving sarif result', () => {
  const cases: Array<[
    string,
    { path: string; displayTargetFile?: string },
    { resultLocationUri: string },
  ]> = [
    [
      'should return the path given there is no target file present',
      { path: 'alpine' },
      { resultLocationUri: 'alpine' },
    ],
    [
      'should return the path without colon characters given there is no target file present and the path contains a tag',
      { path: 'alpine:3.18.0' },
      { resultLocationUri: 'alpine_3.18.0' },
    ],
    [
      'should return the path without colon characters given there is no target file present and the path contains a digest',
      {
        path:
          'alpine@sha256:c0669ef34cdc14332c0f1ab0c2c01acb91d96014b172f1a76f3a39e63d1f0bda',
      },
      {
        resultLocationUri:
          'alpine@sha256_c0669ef34cdc14332c0f1ab0c2c01acb91d96014b172f1a76f3a39e63d1f0bda',
      },
    ],
    [
      'should return the target file given there is a target file present',
      { path: 'alpine', displayTargetFile: 'Dockerfile.test' },
      { resultLocationUri: 'Dockerfile.test' },
    ],
  ];

  it.each(cases)('%s', (_, input, want) => {
    const result = getResults(
      getTestResult({
        displayTargetFile: input.displayTargetFile,
        path: input.path,
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
              artifactLocation: { uri: want.resultLocationUri },
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
