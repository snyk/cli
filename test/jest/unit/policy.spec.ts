import * as policy from 'snyk-policy';
import * as fs from 'fs';
import { getFixturePath } from '../util/getFixturePath';

it('blah', async () => {
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
