import * as fs from 'fs';
import { test } from 'tap';
import * as policy from 'snyk-policy';
import { getPrompts } from '../../src/cli/commands/protect/prompts';
import { getFixturePath } from '../jest/util/getFixturePath';

test('policy file populates ignore reasons', async (t) => {
  const id = 'npm:tar:20151103';
  const vulns = JSON.parse(
    fs.readFileSync(getFixturePath('colonizers-vulns.json'), 'utf-8'),
  ).vulnerabilities;

  try {
    const config = await policy.load(getFixturePath('colonizers'));

    const allPrompts = getPrompts(vulns, config);

    // firstly collect the prompt that matches our vuln id that is the
    // ignore reason - grab the first one
    const prompt = allPrompts
      .filter((p) => {
        return p.name.indexOf('-reason') !== -1;
      })
      .filter((p) => {
        return p.name.indexOf(id) === 0;
      })
      .shift();

    // using the `prompt` (above) filter down and find the full vuln. this is
    // done by the `.name` being the same, except the reason has a `-reason`
    // suffix.
    const singleVuln = allPrompts
      .filter((p) => {
        return p.name === prompt!.name.replace(/-reason$/, '');
      })
      .shift();
    const vuln = singleVuln!.choices![0].value.vuln;

    // now we find the policy rule based on the vulnerability we found, which
    // uses the `.from` to full indentify it (either using glob paths, semver
    // or an exact match).
    const rule = policy.getByVuln(config, vuln);

    t.notEqual(rule.reason, undefined, 'reason should not be undefined');
    t.equal(
      prompt!.default,
      rule.reason,
      'reasons should match in default value',
    );
  } catch (e) {
    t.threw(e);
  }
});
