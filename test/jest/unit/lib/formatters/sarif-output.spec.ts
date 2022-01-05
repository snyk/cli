import { createSarifOutputForContainers } from '../../../../../src/lib/formatters/sarif-output';
import { SEVERITY, TestResult } from '../../../../../src/lib/snyk-test/legacy';
import { SupportedProjectTypes } from '../../../../../src/lib/types';

describe('createSarifOutputForContainers', () => {
  it('general with high severity issue', () => {
    const testFile = getTestResult(SEVERITY.HIGH);
    const sarif = createSarifOutputForContainers([testFile]);
    expect(sarif).toMatchSnapshot();
  });

  it('general with critical severity issue', () => {
    const testFile = getTestResult(SEVERITY.CRITICAL);
    const sarif = createSarifOutputForContainers([testFile]);
    expect(sarif).toMatchSnapshot();
  });
});

function getTestResult(severity: SEVERITY): TestResult {
  return {
    vulnerabilities: [
      {
        credit: [''],
        description:
          '## Overview\nIn libexpat in Expat before 2.2.7, XML input including XML names that contain a large number of colons could make the XML parser consume a high amount of RAM and CPU resources while processing (enough to be usable for denial-of-service attacks).\n\n## References\n- [Bugtraq Mailing List](https://seclists.org/bugtraq/2019/Jun/39)\n- [CVE Details](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2018-20843)\n- [Debian Security Advisory](https://www.debian.org/security/2019/dsa-4472)\n- [Debian Security Announcement](https://lists.debian.org/debian-lts-announce/2019/06/msg00028.html)\n- [Debian Security Tracker](https://security-tracker.debian.org/tracker/CVE-2018-20843)\n- [GitHub Commit](https://github.com/libexpat/libexpat/pull/262/commits/11f8838bf99ea0a6f0b76f9760c43704d00c4ff6)\n- [GitHub Issue](https://github.com/libexpat/libexpat/issues/186)\n- [GitHub PR](https://github.com/libexpat/libexpat/pull/262)\n- [MISC](https://bugs.chromium.org/p/oss-fuzz/issues/detail?id=5226)\n- [MISC](https://github.com/libexpat/libexpat/blob/R_2_2_7/expat/Changes)\n- [Netapp Security Advisory](https://security.netapp.com/advisory/ntap-20190703-0001/)\n- [Ubuntu CVE Tracker](http://people.ubuntu.com/~ubuntu-security/cve/CVE-2018-20843)\n- [Ubuntu Security Advisory](https://usn.ubuntu.com/4040-1/)\n- [Ubuntu Security Advisory](https://usn.ubuntu.com/4040-2/)\n',
        id: 'SNYK-LINUX-EXPAT-450908',
        identifiers: {
          ALTERNATIVE: [
            'SNYK-DEBIAN8-EXPAT-450909',
            'SNYK-DEBIAN9-EXPAT-450910',
            'SNYK-DEBIANUNSTABLE-EXPAT-450911',
            'SNYK-DEBIAN10-EXPAT-450912',
            'SNYK-UBUNTU1404-EXPAT-451027',
            'SNYK-UBUNTU1204-EXPAT-451028',
            'SNYK-UBUNTU1810-EXPAT-451029',
            'SNYK-UBUNTU1604-EXPAT-451030',
            'SNYK-UBUNTU1804-EXPAT-451031',
            'SNYK-ALPINE38-EXPAT-451858',
            'SNYK-ALPINE39-EXPAT-453353',
            'SNYK-ALPINE37-EXPAT-453374',
            'SNYK-ALPINE310-EXPAT-453902',
            'SNYK-DEBIAN11-EXPAT-518187',
            'SNYK-UBUNTU1904-EXPAT-531483',
          ],
          CVE: ['CVE-2018-20843'],
          CWE: ['CWE-611'],
        },
        packageManager: 'linux' as SupportedProjectTypes,
        packageName: 'expat',
        patches: [],
        publicationTime: '2019-06-24T22:21:12.802637Z',
        semver: {
          vulnerableByDistro: {
            'alpine:3.10': ['<2.2.7-r0'],
            'alpine:3.7': ['<2.2.7-r0'],
            'alpine:3.8': ['<2.2.7-r0'],
            'alpine:3.9': ['<2.2.7-r0'],
            'debian:10': ['<2.2.6-2'],
            'debian:11': ['<2.2.6-2'],
            'debian:8': ['<2.1.0-6+deb8u5'],
            'debian:9': ['<2.2.0-2+deb9u2'],
            'debian:unstable': ['<2.2.6-2'],
            'ubuntu:12.04': ['<2.0.1-7.2ubuntu1.6'],
            'ubuntu:14.04': ['<2.1.0-4ubuntu1.4+esm1'],
            'ubuntu:16.04': ['<2.1.0-7ubuntu0.16.04.4'],
            'ubuntu:18.04': ['<2.2.5-3ubuntu0.1'],
            'ubuntu:18.10': ['<2.2.6-1ubuntu0.18.10'],
            'ubuntu:19.04': ['<2.2.6-1ubuntu0.19.04'],
          },
          vulnerable: ['<2.2.7-r0'],
        },
        severity,
        title: 'XML External Entity (XXE) Injection',
        from: [
          'docker-image|garethr/snyky@alpine',
          '.python-rundeps@0',
          'expat@2.2.5-r0',
        ],
        upgradePath: [],
        isUpgradable: false,
        isPatchable: false,
        name: 'expat',
        version: '2.2.5-r0',
        fixedIn: ['2.2.7-r0'],
        parentDepType: 'prod',
        isNew: false,
        below: '',
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
    summary: '165 vulnerable dependencies',
    filesystemPolicy: false,
    uniqueCount: 42,
    projectName: 'PROJECT_NAME',
    foundProjectCount: 22,
  };
}
