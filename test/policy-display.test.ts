import policy from 'snyk-policy';
import { test } from 'tap';
import fs from 'fs';
import { display } from '../src/lib/display-policy';
import stripAnsi from 'strip-ansi';
import { URL } from 'url';

const SNYK_API = process.env.SNYK_API || 'https://snyk.io/api/v1';
const { hostname } = new URL(SNYK_API);

test('test sensibly bails if gets an old .snyk format', async (t) => {
  const filename = __dirname + '/fixtures/snyk-config-no-version';
  const loadedPolicy = await policy.load(filename);
  const expectedFile = await fs.readFileSync(filename + '/expected', 'utf8');

  try {
    const [displayPolicy, expectedFileString] = await Promise.all([
      display(loadedPolicy),
      expectedFile,
    ]);
    const result = stripAnsi(displayPolicy)
      .trim()
      .split('\n')
      .slice(3)
      .join('\n');
    const expected = expectedFileString
      .trim()
      // replace hostname in policy if using env var SNYK_API
      .replace(/snyk\.io/g, hostname)
      .split('\n')
      .slice(3)
      .join('\n');
    t.equal(result, expected);
  } catch (error) {
    t.threw();
  }
});
