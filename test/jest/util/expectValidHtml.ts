/**
 * Checks that the output is a complete HTML document. The exact markup is
 * covered by the golden files in go-application-framework's presenters.
 */
export function expectValidHtml(output: string) {
  expect(output).toMatch(/^<!doctype html>/i);
  expect(output).toMatch(/<html[\s>]/);
  expect(output.trimEnd()).toMatch(/<\/html>$/);
}

export const htmlDoctype = /^<!doctype html>/i;
