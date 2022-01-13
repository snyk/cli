import { test } from 'tap';

import { nextSteps as prompts } from '../../src/cli/commands/protect/prompts';
import { getFixturePath } from '../jest/util/getFixturePath';

test('wizard next steps include protect correctly', async (t) => {
  let res = prompts({}, false);

  t.equal(res.length, 1, 'contains 1 entry');
  t.equal(res[0].name, 'misc-add-test', 'only entry is test');

  res = prompts(
    {
      scripts: {
        test: 'snyk test',
      },
    },
    false,
  );

  t.equal(res.length, 0, 'there are no next steps');

  res = prompts(
    {
      scripts: {
        test: 'snyk test',
        postinstall: 'snyk protect',
      },
    },
    {},
  );

  t.equal(
    res.length,
    0,
    'there are no next steps when protect is already in place',
  );

  // now test if there's a patch it should apply the protect
  res = prompts(
    {
      scripts: {
        test: 'snyk test', // we're not interested in test atm
      },
    },
    require(getFixturePath('wizard-patch-answers.json')),
  );

  t.equal(res.length, 1, 'protect is included');
  t.equal(res[0].name, 'misc-add-protect', 'only entry is protect');

  // now test if there's a patch it should apply the protect
  res = prompts(
    {
      scripts: {
        test: 'snyk test', // we're not interested in test atm
      },
    },
    require(getFixturePath('wizard-patch-answers.json')),
  );

  t.equal(res.length, 1, 'protect is included');
  t.equal(res[0].name, 'misc-add-protect', 'only entry is protect');

  // these answers should not add any extra steps
  res = prompts(
    {
      scripts: {
        test: 'snyk test', // we're not interested in test atm
      },
    },
    {
      random: {
        choice: 'update',
      },
    },
  );

  t.equal(res.length, 0, 'no next steps');
});
