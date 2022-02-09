import * as fs from 'fs';
import { test } from 'tap';
import * as policy from 'snyk-policy';
import { getPrompts } from '../../src/cli/commands/protect/prompts';
import { getFixturePath } from '../jest/util/getFixturePath';

test('ensure that when there is not remediation, prompt text is correct', async function (t) {
  const vulns = JSON.parse(
    fs.readFileSync(getFixturePath('colonizers-vulns.json'), 'utf-8'),
  ).vulnerabilities;

  try {
    const config = await policy.load(getFixturePath('colonizers'));
    const promptOptions = getPrompts(vulns, config);
    // firstly filter down to just the update prompts
    const res = promptOptions
      .map(function (_) {
        return _.choices;
      })
      .map(function (_) {
        return _
          ? _.filter(function (_) {
              return _.key === 'u';
            }).pop()
          : false;
      })
      .filter(Boolean);

    // now pick out those that say they'll notify and check the vuln really
    // doesn't have a remediation path
    // res = res.filter(_ => _.name.indexOf('notify') !== -1);
    res.forEach(function (_) {
      if (_.name.indexOf('notify') !== -1) {
        t.notEqual(
          _.value.vuln.upgradePath.filter(Boolean).length,
          _.value.vuln.from.length - 1,
          'Upgrade path is shorter than dep depth ∴ no remediation',
        );
      } else {
        t.equal(
          _.value.vuln.upgradePath.filter(Boolean).length,
          _.value.vuln.from.length - 1,
          'Upgrade path has remediation',
        );
      }
    });
  } catch (e) {
    t.threw(e);
  }
});
