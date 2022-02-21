import * as policy from 'snyk-policy';
import * as fs from 'fs';
import { display } from '../../../src/lib/display-policy';
import stripAnsi from 'strip-ansi';
import { URL } from 'url';
import { getFixturePath } from '../util/getFixturePath';

const SNYK_API = process.env.SNYK_API || 'https://snyk.io/api/v1';
const { hostname } = new URL(SNYK_API);

it('test sensibly bails if gets an old .snyk format', async () => {
  const filename = getFixturePath('snyk-config-no-version');
  const loadedPolicy = await policy.load(filename);
  const expectedFile = await fs.readFileSync(filename + '/expected', 'utf8');

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
  expect(result).toEqual(expected);
});
