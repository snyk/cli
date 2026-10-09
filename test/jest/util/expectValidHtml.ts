/**
 * Asserts HTML report issue count and card count
 */
export function expectValidHtml(output: string, openIssues: number): void {
  expect(output).toMatch(htmlDoctype);
  expect(output).toMatch(/<html[\s>]/);
  expect(output.trimEnd()).toMatch(/<\/html>$/);
  expect(output).toContain(`content="${openIssues} open issues`);
  expect(output.match(/<div class="issue-card /g) ?? []).toHaveLength(
    openIssues,
  );
}

export const htmlDoctype = /^<!doctype html>/i;
