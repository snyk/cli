/*
 * https://www.python.org/dev/peps/pep-0426/#name
 * All comparisons of distribution names MUST be case insensitive,
 * and MUST consider hyphens and underscores to be equivalent.
 *
 */
export function standardizePackageName(name: string): string {
  return name.replace('_', '-').toLowerCase();
}
