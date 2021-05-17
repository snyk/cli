import { IssuesData } from '../../types';

export function getTotalIssueCount(issueData: IssuesData[]): number {
  let total = 0;

  for (const entry of issueData) {
    total += Object.keys(entry).length;
  }

  return total;
}
