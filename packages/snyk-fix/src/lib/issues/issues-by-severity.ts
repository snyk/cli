import { IssuesData } from '../../types';

export function getIssueCountBySeverity(issueData: IssuesData[]): {
  low: string[];
  medium: string[];
  high: string[];
  critical: string[];
} {
  const total = {
    low: [],
    medium: [],
    high: [],
    critical: [],
  };

  for (const entry of issueData) {
    for (const issue of Object.values(entry)) {
      const { severity, id } = issue;
      total[severity.toLowerCase()].push(id);
    }
  }

  return total;
}
