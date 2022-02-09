import { createSarifOutputForOpenSource } from '../../../../../src/lib/formatters/open-source-sarif-output';
import { SEVERITY, TestResult } from '../../../../../src/lib/snyk-test/legacy';

describe('createSarifOutputForOpenSource', () => {
  it('general', () => {
    const testFile = getTestResult();
    const sarif = createSarifOutputForOpenSource([testFile]);
    expect(sarif).toMatchSnapshot();
  });

  describe('replace lock-file to manifest-file', () => {
    const lockFiles = [
      'Gemfile.lock',
      'package-lock.json',
      'yarn.lock',
      'Gopkg.lock',
      'go.sum',
      'composer.lock',
      'Podfile.lock',
      'poetry.lock',
    ];

    lockFiles.forEach((lockFileName) =>
      it(lockFileName, () => {
        const time = Date.now();
        const testFile = getTestResult({
          displayTargetFile: `${time}/${lockFileName}`,
        });
        const sarif = createSarifOutputForOpenSource([testFile]);
        const uri =
          sarif.runs?.[0]?.results?.[0].locations?.[0]?.physicalLocation?.artifactLocation?.uri?.replace(
            `${time}/`,
            '',
          );
        expect(uri).toMatchSnapshot();
      }),
    );
  });
});

function getTestResult(testResultOverride = {}, vulnOverride = {}): TestResult {
  return {
    vulnerabilities: [
      {
        below: '',
        credit: ['Unknown'],
        description: '## Overview\n',
        fixedIn: ['6.12.3'],
        id: 'SNYK-JS-AJV-584908',
        identifiers: {
          CVE: ['CVE-2020-15366'],
          CWE: ['CWE-400'],
        },
        moduleName: 'ajv',
        packageManager: 'npm',
        packageName: 'ajv',
        patches: [],
        publicationTime: '2020-07-16T13:58:04Z',
        semver: {
          vulnerable: ['<6.12.3'],
        },
        severity: SEVERITY.CRITICAL,
        title: 'Prototype Pollution',
        from: [
          'PROJECT_NAME@1.0.0',
          'jimp@0.2.28',
          'request@2.88.2',
          'har-validator@5.1.3',
          'ajv@6.12.2',
        ],
        upgradePath: [
          false,
          'jimp@0.2.28',
          'request@2.88.2',
          'har-validator@5.1.3',
          'ajv@6.12.3',
        ],
        isUpgradable: true,
        isPatchable: false,
        name: 'ajv',
        version: '6.12.2',
        __filename: 'node_modules/ajv/package.json',
        parentDepType: 'prod',
        isNew: false,
        ...vulnOverride,
      },
    ],
    ok: false,
    dependencyCount: 969,
    org: 'ORG',
    policy: '',
    isPrivate: true,
    licensesPolicy: {
      severities: {},
      orgLicenseRules: {},
    },
    packageManager: 'npm',
    ignoreSettings: null,
    summary: '165 vulnerable dependency paths',
    filesystemPolicy: false,
    uniqueCount: 42,
    projectName: 'PROJECT_NAME',
    foundProjectCount: 22,
    displayTargetFile: 'package.json',
    ...testResultOverride,
  };
}
