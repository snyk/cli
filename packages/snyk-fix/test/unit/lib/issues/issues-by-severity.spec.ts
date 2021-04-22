import { getIssueCountBySeverity } from '../../../../src/lib/issues/issues-by-severity';
import { IssuesData, SEVERITY } from '../../../../src/types';

describe('getIssueCountBySeverity', () => {
  it('correctly returns when no issues', () => {
    const issueData = [];
    const res = getIssueCountBySeverity(issueData);
    expect(res).toEqual({
      critical: [],
      high: [],
      low: [],
      medium: [],
    });
  });

  it('correctly returns when all severities are present', () => {
    const issueData: IssuesData[] = [
      {
        'SNYK-1': {
          title: 'Critical severity issue',
          severity: SEVERITY.CRITICAL,
          id: 'SNYK-1',
        },
      },
      {
        'SNYK-2': {
          title: 'High severity issue',
          severity: SEVERITY.HIGH,
          id: 'SNYK-2',
        },
      },
      {
        'SNYK-3': {
          title: 'High severity issue',
          severity: SEVERITY.MEDIUM,
          id: 'SNYK-3',
        },
      },
      {
        'SNYK-4': {
          title: 'High severity issue',
          severity: SEVERITY.LOW,
          id: 'SNYK-4',
        },
      },
    ];
    const res = getIssueCountBySeverity(issueData);
    expect(res).toEqual({
      critical: ['SNYK-1'],
      high: ['SNYK-2'],
      low: ['SNYK-4'],
      medium: ['SNYK-3'],
    });
  });

  it('correctly returns when some severities are present', () => {
    const issueData: IssuesData[] = [
      {
        'SNYK-1': {
          title: 'Critical severity issue',
          severity: SEVERITY.CRITICAL,
          id: 'SNYK-1',
        },
      },
      {
        'SNYK-2': {
          title: 'Critical severity issue',
          severity: SEVERITY.CRITICAL,
          id: 'SNYK-2',
        },
      },
      {
        'SNYK-3': {
          title: 'Critical severity issue',
          severity: SEVERITY.CRITICAL,
          id: 'SNYK-3',
        },
      },
      {
        'SNYK-4': {
          title: 'High severity issue',
          severity: SEVERITY.MEDIUM,
          id: 'SNYK-4',
        },
      },
      {
        'SNYK-5': {
          title: 'High severity issue',
          severity: SEVERITY.MEDIUM,
          id: 'SNYK-5',
        },
      },
    ];
    const res = getIssueCountBySeverity(issueData);
    expect(res).toEqual({
      critical: ['SNYK-1', 'SNYK-2', 'SNYK-3'],
      high: [],
      low: [],
      medium: ['SNYK-4', 'SNYK-5'],
    });
  });
});
