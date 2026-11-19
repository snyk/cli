import * as fs from 'fs';
import * as path from 'path';

/**
 * Regression for CVE-2024-47764 (SNYK-JS-COOKIE-8163060): cookie < 0.7.0
 * was pulled in via @sentry/node@7.36.0. Fixed by bumping @sentry/node to a
 * release that no longer depends on cookie (7.80+; we pin ^7.120.4).
 */
function versionAtLeast(version: string, minimum: string): boolean {
  const parse = (value: string): number[] =>
    value
      .split('-')[0]
      .split('.')
      .map((part) => parseInt(part, 10) || 0);

  const actual = parse(version);
  const expected = parse(minimum);
  const length = Math.max(actual.length, expected.length);

  for (let i = 0; i < length; i++) {
    const left = actual[i] || 0;
    const right = expected[i] || 0;
    if (left > right) {
      return true;
    }
    if (left < right) {
      return false;
    }
  }

  return true;
}

describe('dependency security', () => {
  const lockfilePath = path.join(__dirname, '..', '..', 'package-lock.json');
  const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));

  it('does not resolve a vulnerable cookie via @sentry/node', () => {
    const sentry = lockfile.packages?.['node_modules/@sentry/node'];
    expect(sentry).toBeDefined();
    expect(versionAtLeast(sentry.version, '7.80.0')).toBe(true);
    expect(sentry.dependencies?.cookie).toBeUndefined();

    const cookie = lockfile.packages?.['node_modules/cookie'];
    if (cookie) {
      expect(versionAtLeast(cookie.version, '0.7.0')).toBe(true);
    }
  });
});
