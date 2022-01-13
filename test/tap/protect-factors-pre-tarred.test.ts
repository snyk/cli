import { test } from 'tap';
import { loadFromText } from 'snyk-policy';
import * as fs from 'fs';
import { loadJson } from '../utils';
import { getFixturePath } from '../jest/util/getFixturePath';

test('pre-tarred packages can be ignored', async (t) => {
  const res = loadJson(getFixturePath('forever.json'));
  const text = fs.readFileSync(getFixturePath('policies/forever'), 'utf8');
  const policy = await loadFromText(text);
  policy.skipVerifyPatch = true;
  const protectedValues = policy.filter(res);

  t.equal(protectedValues.ok, true, 'all vulns have been stripped');
  t.deepEqual(
    protectedValues.vulnerabilities,
    [],
    'all vulns have been stripped',
  );
});
