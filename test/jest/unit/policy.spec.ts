import * as policy from 'snyk-policy';
import * as fs from 'fs';
import { getFixturePath } from '../util/getFixturePath';

it('does not ignore vulnerabilities with invalid expiry dates', async () => {
  const loadedPolicy = await policy.load(
    getFixturePath('snyk-ignores-invalid-expiry'),
  );
  const vulns = JSON.parse(
    fs.readFileSync(
      'test/fixtures/snyk-ignores-invalid-expiry/vulns.json',
      'utf-8',
    ),
  );

  expect(vulns.vulnerabilities).toHaveLength(3);

  // should not keep all vulns, because all of the ignores have invalid expiry date
  const result = loadedPolicy.filter(vulns);
  expect(result.ok).toBe(false);
  expect(result.vulnerabilities).toHaveLength(2);
  expect(result.filtered.ignore).toHaveLength(1);
});

it('applies ignore when a valid (non-expired) rule exists for the issue id', async () => {
  const issueToIgnore = {
    id: 'NPM-HAWK:123',
    name: 'problem',
    from: [''],
    isPatchable: false,
  };

  const issueToNotIgnore = {
    id: '5678',
    name: 'five six seven eight!',
    from: [''],
    isPatchable: false,
  };

  const vulnerabilities = [issueToIgnore, issueToNotIgnore];

  const loadedPolicy = await policy.loadFromText(`
ignore:
  ${issueToIgnore.id}:
    - '*':
        reason: None given
        expires: '2024-01-01T01:01:01.000Z'
  ${issueToIgnore.id.toLowerCase()}:
    - '*':
        reason: None given
        expires: '2999-01-01T01:01:01.000Z'
`);

  const input = { ok: false, vulnerabilities: vulnerabilities as any[] } as any;
  const root = process.cwd();
  const result = loadedPolicy.filter(input, root);

  // One vulnerability should be ignored according to policy
  expect(result.filtered.ignore.length).toBe(1);

  const remainingIds = result.vulnerabilities.map((v: any) => v.id);
  expect(remainingIds).not.toContain(issueToIgnore.id);
  expect(remainingIds).toContain(issueToNotIgnore.id);
});
