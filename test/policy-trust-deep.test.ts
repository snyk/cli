import * as tap from 'tap';
import * as cli from '../src/cli/commands';
const dir = __dirname + '/fixtures/qs-package';
const { test } = tap;

let originalVulnCount;

test('`snyk test` sees suggested ignore policies', async (t) => {
  try {
    await cli.test(dir);
  } catch (res) {
    const vulns = res.message.toLowerCase();
    t.notEqual(
      vulns.indexOf(
        'suggests ignoring this issue, with reason: test trust policies',
      ),
      -1,
      'found suggestion to ignore',
    );

    originalVulnCount = count('✗', vulns);
  }
});

test('`snyk test` ignores when applying `--trust-policies`', async (t) => {
  try {
    await cli.test(dir, { 'trust-policies': true });
  } catch (res) {
    const vulnCount = count('✗', res.message.trim());
    t.equal(originalVulnCount - vulnCount, 2, '2 vulns ignored');
  }
});

function count(needle, haystack) {
  return (
    haystack.toLowerCase().match(new RegExp(needle.toLowerCase(), 'g')) || []
  ).length;
}
