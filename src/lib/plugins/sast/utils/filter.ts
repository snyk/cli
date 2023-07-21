import { Result } from 'sarif';

export function filterIgnoredIssues(analysisResults: Result[]): Result[] {
  return analysisResults.filter(
    (rule) => (rule.suppressions?.length ?? 0) === 0,
  );
}
