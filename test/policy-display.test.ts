import * as policy from 'snyk-policy';
import { test } from 'tap';
import * as fs from 'then-fs';
import { display } from '../src/lib/display-policy';
import stripAnsi from 'strip-ansi';

test('test sensibly bails if gets an old .snyk format', async (t) => {
  const filename = __dirname + '/fixtures/snyk-config-no-version';
  const loadedPolicy = await policy.load(filename);
  const expectedFile = await fs.readFile(filename + '/expected', 'utf8');

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
      .split('\n')
      .slice(3)
      .join('\n');
    t.equal(result, expected);
  } catch (error) {
    t.threw();
  }
});
