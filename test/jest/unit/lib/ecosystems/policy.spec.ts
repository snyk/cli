import { Issue, IssuesData } from '../../../../../src/lib/ecosystems/types';
import { Policy } from '../../../../../src/lib/policy/find-and-load-policy';
import { SEVERITY } from '@snyk/fix/dist/types';
import { filterIgnoredIssues } from '../../../../../src/lib/ecosystems/policy';

describe('filterIgnoredIssues fn', () => {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const getCurrentDate = () => new Date();
  const getFutureDate = () => new Date(Date.now() + ONE_HOUR_MS);
  const getPastDate = () => new Date(Date.now() - ONE_HOUR_MS);

  it('should filter the not-expired ignored issues', () => {
    const issues: Issue[] = [
      {
        pkgName: 'https://foo.bar|test1',
        pkgVersion: '1.0.0',
        issueId: 'SNYK-TEST-1',
        fixInfo: {
          isPatchable: false,
          upgradePaths: [],
        },
      },
      {
        pkgName: 'https://foo.bar|test2',
        pkgVersion: '2.0.0',
        issueId: 'SNYK-TEST-2',
        fixInfo: {
          isPatchable: false,
          upgradePaths: [],
        },
      },
    ];
    const issuesData: IssuesData = {
      'SNYK-TEST-1': {
        title: 'Arbitrary Code Execution',
        severity: SEVERITY.LOW,
        id: 'SNYK-TEST-1',
      },
      'SNYK-TEST-2': {
        title: 'Arbitrary Code Execution',
        severity: SEVERITY.MEDIUM,
        id: 'SNYK-TEST-2',
      },
    };
    const policy = {
      ignore: {
        'SNYK-TEST-1': [
          {
            '*': {
              reason: 'None Given',
              created: getCurrentDate(),
              expires: getFutureDate(),
            },
          },
        ],
      },
    };

    const [filteredIssues, filteredIssuesData] = filterIgnoredIssues(
      issues,
      issuesData,
      policy as Policy,
    );

    expect(filteredIssues).toEqual([
      {
        pkgName: 'https://foo.bar|test2',
        pkgVersion: '2.0.0',
        issueId: 'SNYK-TEST-2',
        fixInfo: {
          isPatchable: false,
          upgradePaths: [],
        },
      },
    ]);
    expect(filteredIssuesData).toEqual({
      'SNYK-TEST-2': {
        title: 'Arbitrary Code Execution',
        severity: SEVERITY.MEDIUM,
        id: 'SNYK-TEST-2',
      },
    });
  });

  it('should not filter the expired ignored issues', () => {
    const issues: Issue[] = [
      {
        pkgName: 'https://foo.bar|test1',
        pkgVersion: '1.0.0',
        issueId: 'SNYK-TEST-1',
        fixInfo: {
          isPatchable: false,
          upgradePaths: [],
        },
      },
      {
        pkgName: 'https://foo.bar|test2',
        pkgVersion: '2.0.0',
        issueId: 'SNYK-TEST-2',
        fixInfo: {
          isPatchable: false,
          upgradePaths: [],
        },
      },
    ];
    const issuesData: IssuesData = {
      'SNYK-TEST-1': {
        title: 'Arbitrary Code Execution',
        severity: SEVERITY.LOW,
        id: 'SNYK-TEST-1',
      },
      'SNYK-TEST-2': {
        title: 'Arbitrary Code Execution',
        severity: SEVERITY.MEDIUM,
        id: 'SNYK-TEST-2',
      },
    };
    const policy = {
      ignore: {
        'SNYK-TEST-1': [
          {
            '*': {
              reason: 'None Given',
              created: getCurrentDate(),
              expires: getPastDate(),
            },
          },
        ],
      },
    };

    const [filteredIssues, filteredIssuesData] = filterIgnoredIssues(
      issues,
      issuesData,
      policy as Policy,
    );

    expect(filteredIssues).toEqual(issues);
    expect(filteredIssuesData).toEqual(issuesData);
  });

  it('should handle empty issue array', () => {
    const issues: Issue[] = [];
    const issuesData: IssuesData = {
      'SNYK-TEST-1': {
        title: 'Arbitrary Code Execution',
        severity: SEVERITY.LOW,
        id: 'SNYK-TEST-1',
      },
    };
    const policy = {
      ignore: {
        'SNYK-TEST-1': [
          {
            '*': {
              reason: 'None Given',
              created: getCurrentDate(),
              expires: getFutureDate(),
            },
          },
        ],
      },
    };

    const [filteredIssues, filteredIssuesData] = filterIgnoredIssues(
      issues,
      issuesData,
      policy as Policy,
    );

    expect(filteredIssues).toEqual([]);
    expect(filteredIssuesData).toEqual(issuesData);
  });

  it('should handle empty issues data object', () => {
    const issues: Issue[] = [
      {
        pkgName: 'https://foo.bar|test1',
        pkgVersion: '1.0.0',
        issueId: 'SNYK-TEST-1',
        fixInfo: {
          isPatchable: false,
          upgradePaths: [],
        },
      },
    ];
    const issuesData: IssuesData = {};
    const policy = {
      ignore: {
        'SNYK-TEST-1': [
          {
            '*': {
              reason: 'None Given',
              created: getCurrentDate(),
              expires: getFutureDate(),
            },
          },
        ],
      },
    };

    const [filteredIssues, filteredIssuesData] = filterIgnoredIssues(
      issues,
      issuesData,
      policy as Policy,
    );

    expect(filteredIssues).toEqual([]);
    expect(filteredIssuesData).toEqual({});
  });

  it('should handle undefined policy file', () => {
    const issues: Issue[] = [
      {
        pkgName: 'https://foo.bar|test1',
        pkgVersion: '1.0.0',
        issueId: 'SNYK-TEST-1',
        fixInfo: {
          isPatchable: false,
          upgradePaths: [],
        },
      },
    ];
    const issuesData: IssuesData = {
      'SNYK-TEST-1': {
        title: 'Arbitrary Code Execution',
        severity: SEVERITY.LOW,
        id: 'SNYK-TEST-1',
      },
    };
    const policy = undefined;

    const [filteredIssues, filteredIssuesData] = filterIgnoredIssues(
      issues,
      issuesData,
      policy,
    );

    expect(filteredIssues).toEqual(issues);
    expect(filteredIssuesData).toEqual(issuesData);
  });

  it('should handle empty policy file', () => {
    const issues: Issue[] = [
      {
        pkgName: 'https://foo.bar|test1',
        pkgVersion: '1.0.0',
        issueId: 'SNYK-TEST-1',
        fixInfo: {
          isPatchable: false,
          upgradePaths: [],
        },
      },
    ];
    const issuesData: IssuesData = {
      'SNYK-TEST-1': {
        title: 'Arbitrary Code Execution',
        severity: SEVERITY.LOW,
        id: 'SNYK-TEST-1',
      },
    };
    const policy = {
      ignore: {},
    };

    const [filteredIssues, filteredIssuesData] = filterIgnoredIssues(
      issues,
      issuesData,
      policy as Policy,
    );

    expect(filteredIssues).toEqual(issues);
    expect(filteredIssuesData).toEqual(issuesData);
  });
});
